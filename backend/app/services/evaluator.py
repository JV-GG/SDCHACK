from datetime import datetime, timezone
import uuid
from app.models.schemas import (
    SMEProfile,
    Invoice,
    ClaimsReadinessPackage,
    AuditEntry
)
from app.rules import ALL_GRANT_RULES
from app.services.llm_service import generate_grant_narrative

def evaluate_claim_package(company: SMEProfile, invoice: Invoice) -> ClaimsReadinessPackage:
    now_iso = datetime.now(timezone.utc).isoformat()
    claim_id = f"CLM-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

    evaluations = []
    narratives = []
    total_claimable = 0.0

    # 1. Run deterministic rules engine
    for rule in ALL_GRANT_RULES:
        result = rule.evaluate(company, invoice)
        evaluations.append(result)
        if result.isEligible:
            total_claimable += result.maxCoFundingMYR
            narrative = generate_grant_narrative(company, invoice, result)
            narratives.append(narrative)

    # 2. Build audit trail
    audit_trail = [
        AuditEntry(
            action=f"Invoice #{invoice.invoiceNumber} ingested from {invoice.vendorName}",
            timestamp=now_iso,
            performedBy="Connected Ingestion Engine"
        ),
        AuditEntry(
            action=f"Deterministic rules engine evaluated {len(evaluations)} national grant schemes",
            timestamp=now_iso,
            performedBy="Hybrid Rules Engine"
        ),
    ]

    if narratives:
        audit_trail.append(
            AuditEntry(
                action=f"Generated {len(narratives)} grant application narratives & ROI justifications",
                timestamp=now_iso,
                performedBy="Lightweight LLM Agent"
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
        auditTrail=audit_trail
    )
