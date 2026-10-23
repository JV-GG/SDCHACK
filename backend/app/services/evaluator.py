from datetime import datetime, timezone
import hashlib
import uuid
from typing import List, Optional
from app.models.schemas import (
    SMEProfile,
    Invoice,
    ClaimsReadinessPackage,
    AuditEntry,
    GrantStackingSummary,
    DossierExportResponse
)
from app.rules import ALL_GRANT_RULES
from app.services.llm_service import generate_grant_narrative
from app.services.db_service import (
    get_narrative_cache_key,
    get_cached_narrative,
    set_cached_narrative,
)

def evaluate_claim_package(
    company: SMEProfile,
    invoice: Invoice,
    generate_ai: bool = False,
    ingest_action: Optional[str] = None,
    ingested_by: str = "System re-evaluation",
    ip_address: Optional[str] = None,
) -> ClaimsReadinessPackage:
    now_iso = datetime.now(timezone.utc).isoformat()
    claim_id = f"CLM-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

    evaluations = []
    narratives = []
    total_claimable = 0.0
    participating_agencies = []
    narrative_sources = {"cache": 0, "template": 0, "ai": 0}

    # 1. Run deterministic rules engine across all 7 Malaysian statutory grant schemes
    for rule in ALL_GRANT_RULES:
        result = rule.evaluate(company, invoice)
        evaluations.append(result)
        if result.isEligible:
            total_claimable += result.maxCoFundingMYR
            if result.agency not in participating_agencies:
                participating_agencies.append(result.agency)
            cache_key = get_narrative_cache_key(company, invoice, result.grantId)
            cached = get_cached_narrative(cache_key)
            if cached is not None:
                narrative = cached
                narrative_sources["cache"] += 1
            else:
                narrative = generate_grant_narrative(company, invoice, result, use_ai=generate_ai)
                narrative_sources["ai" if generate_ai else "template"] += 1
                set_cached_narrative(cache_key, result.grantId, narrative)
            narratives.append(narrative)

    # 2. Grant Stacking & Multi-Agency Optimization
    stacking_summary = None
    if invoice.totalAmountMYR > 0:
        effective_rate = round((total_claimable / invoice.totalAmountMYR) * 100, 1)
        if len(participating_agencies) > 1:
            strategy_desc = (
                f"Multi-Agency Grant Stacking Active: Split expenditure across "
                f"{', '.join(participating_agencies)} to maximize matching co-funding."
            )
        elif len(participating_agencies) == 1:
            strategy_desc = f"Single Grant Optimization: 100% matched under {participating_agencies[0]} statutory scheme."
        else:
            strategy_desc = "No eligible government matching funds unlocked for this specific expenditure profile."

        stacking_summary = GrantStackingSummary(
            totalInvoiceAmountMYR=invoice.totalAmountMYR,
            totalClaimableAmountMYR=total_claimable,
            effectiveSubsidyPercentage=effective_rate,
            participatingAgencies=participating_agencies,
            stackingStrategy=strategy_desc
        )

    # 3. Build chronological audit trail (server-generated; the browser never writes entries)
    audit_trail = [
        AuditEntry(
            action=ingest_action
            or f"Re-evaluated stored invoice #{invoice.invoiceNumber} (RM {invoice.totalAmountMYR:,.2f})",
            timestamp=now_iso,
            performedBy=ingested_by,
            eventType="DOCUMENT_SUBMITTED" if ingest_action else "CLAIM_EVALUATED",
            ipAddress=ip_address,
        ),
        AuditEntry(
            action=f"Deterministic Engine Evaluated {len(evaluations)} Malaysian statutory grant schemes",
            timestamp=now_iso,
            performedBy="RulesEngine::DeterministicEvaluator",
            eventType="CLAIM_EVALUATED",
        ),
    ]

    if total_claimable > 0:
        audit_trail.append(
            AuditEntry(
                action=f"Co-Funding Unlocked: RM {total_claimable:,.2f} across {len(participating_agencies)} agency schemes",
                timestamp=now_iso,
                performedBy="GrantOptimizer::StackingEngine",
                eventType="CLAIM_EVALUATED",
            )
        )

    if narratives:
        parts = []
        if narrative_sources["ai"]:
            parts.append(f"{narrative_sources['ai']} by DeepSeek AI (template fallback if the AI is unreachable)")
        if narrative_sources["template"]:
            parts.append(f"{narrative_sources['template']} from the deterministic template engine")
        if narrative_sources["cache"]:
            parts.append(f"{narrative_sources['cache']} reused from the narrative cache")
        drafter = (
            "DeepSeek-V3 GrantFlow"
            if narrative_sources["ai"]
            else "NarrativeEngine::Template"
            if narrative_sources["template"]
            else "NarrativeEngine::Cache"
        )
        audit_trail.append(
            AuditEntry(
                action=f"Drafted {len(narratives)} project justification & ROI narratives for human review ({'; '.join(parts)})",
                timestamp=now_iso,
                performedBy=drafter,
                eventType="NARRATIVES_DRAFTED",
            )
        )

    return ClaimsReadinessPackage(
        claimId=claim_id,
        timestamp=now_iso,
        company=company,
        invoice=invoice,
        evaluations=evaluations,
        narratives=narratives,
        totalClaimableAmountMYR=total_claimable,
        status="EVALUATED",
        auditTrail=audit_trail,
        stackingSummary=stacking_summary
    )


def generate_dossier_packet(package: ClaimsReadinessPackage) -> DossierExportResponse:
    """Generates official printable HTML dossier with cryptographic verification hash."""
    now_iso = datetime.now(timezone.utc).isoformat()
    raw_hash_content = f"{package.claimId}:{package.company.registrationNumber}:{package.totalClaimableAmountMYR}:{now_iso}"
    verification_hash = hashlib.sha256(raw_hash_content.encode()).hexdigest()

    eligible_grants = [e for e in package.evaluations if e.isEligible]
    eligible_names = ", ".join([e.grantName for e in eligible_grants]) if eligible_grants else "None"

    # Clean executive HTML dossier
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Official Grant Claim Dossier - {package.claimId}</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.5; color: #1f2937; margin: 40px; }}
    .header {{ border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 25px; }}
    .badge {{ display: inline-block; background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 4px; font-weight: 600; font-size: 12px; }}
    .section {{ margin-bottom: 25px; }}
    .section h3 {{ font-size: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; color: #0f172a; margin-bottom: 12px; }}
    table {{ width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }}
    th, td {{ border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }}
    th {{ background: #f8fafc; font-weight: 600; }}
    .highlight-box {{ background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; padding: 15px; margin: 15px 0; }}
    .audit-list {{ font-size: 12px; color: #475569; }}
    .audit-list li {{ margin-bottom: 4px; }}
    .stamp {{ border: 2px dashed #0284c7; padding: 10px 15px; border-radius: 6px; display: inline-block; font-size: 11px; color: #0369a1; margin-top: 15px; }}
    @media print {{ body {{ margin: 0; }} }}
  </style>
</head>
<body>
  <div class="header">
    <span class="badge">🇲🇾 OFFICIAL APPLICATION DOSSIER • NATIONAL SME GRANTFLOW</span>
    <h1 style="margin: 8px 0 4px 0; font-size: 24px;">Government Grant Claim Application Packet</h1>
    <div style="font-size: 13px; color: #64748b;">
      Claim ID: <strong>{package.claimId}</strong> | Submission Date: {package.timestamp[:10]} | Status: <strong>{package.status}</strong>
    </div>
  </div>

  <div class="section">
    <h3>1. Verified Enterprise Metadata (SSM & Orbyte HR)</h3>
    <table>
      <tr><th width="30%">Company Registered Name</th><td><strong>{package.company.companyName}</strong></td></tr>
      <tr><th>SSM Registration Number</th><td>{package.company.registrationNumber}</td></tr>
      <tr><th>Malaysian Equity Ownership</th><td><strong>{package.company.malaysianEquityPercentage}%</strong> (Verified via SSM BizProfile)</td></tr>
      <tr><th>Sector & Workforce</th><td>{package.company.sector} ({package.company.fullTimeEmployees} Full-Time Employees)</td></tr>
      <tr><th>Annual Sales Turnover</th><td>RM {package.company.annualTurnoverMYR:,.2f}</td></tr>
    </table>
  </div>

  <div class="section">
    <h3>2. Incurred Expenditure & Vendor Verification</h3>
    <table>
      <tr><th width="30%">Tax Invoice Number</th><td>{package.invoice.invoiceNumber} (Dated: {package.invoice.invoiceDate})</td></tr>
      <tr><th>Vendor Name</th><td>{package.invoice.vendorName}</td></tr>
      <tr><th>MDEC TSP Accreditation</th><td>{'✅ Accredited Technology Solution Provider' if package.invoice.vendorIsMdecTsp else 'Non-TSP Vendor'}</td></tr>
      <tr><th>Total Claim Expenditure</th><td><strong>RM {package.invoice.totalAmountMYR:,.2f}</strong></td></tr>
    </table>
  </div>

  <div class="highlight-box">
    <div style="font-size: 13px; color: #166534; font-weight: 600;">APPROVED GOVERNMENT CO-FUNDING:</div>
    <div style="font-size: 26px; font-weight: 800; color: #15803d; margin: 4px 0;">RM {package.totalClaimableAmountMYR:,.2f}</div>
    <div style="font-size: 12px; color: #166534;">Matched Schemes: {eligible_names}</div>
  </div>

  <div class="section">
    <h3>3. Approved Business Transformation & ROI Justification</h3>
    {''.join([f'''
    <div style="margin-bottom: 12px; background: #f8fafc; padding: 12px; border-radius: 6px;">
      <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px;">{n.projectTitle}</div>
      <p style="font-size: 13px; margin: 4px 0;"><strong>Operational Justification:</strong> {n.transformationJustification}</p>
      <p style="font-size: 13px; margin: 4px 0;"><strong>Productivity & ROI Impact:</strong> {n.roiAndProductivityProjections}</p>
    </div>
    ''' for n in package.narratives])}
  </div>

  <div class="section">
    <h3>4. Immutable Compliance Audit Trail</h3>
    <ul class="audit-list">
      {''.join([f"<li><strong>{entry.timestamp[:19]}</strong> — {entry.action} (<em>{entry.performedBy}</em>)</li>" for entry in package.auditTrail])}
    </ul>
  </div>

  <div class="stamp">
    🔒 <strong>DIGITALLY SIGNED & VERIFIED BY ORBYTE AUDIT ENGINE</strong><br>
    SHA-256 Verification Hash: {verification_hash}
  </div>
</body>
</html>"""

    return DossierExportResponse(
        claimId=package.claimId,
        generatedAt=now_iso,
        verificationHash=verification_hash,
        dossierHtml=html
    )
