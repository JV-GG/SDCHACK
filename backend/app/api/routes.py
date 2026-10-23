import json
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, Request
from app.models.schemas import (
    ClaimEvaluationRequest,
    ClaimsReadinessPackage,
    AuditEntry,
    DemoScenario,
    RawInvoiceParseRequest,
    Invoice,
    DossierExportResponse,
    OrganizationAccount,
    OrganizationRegisterRequest,
    OrganizationLoginRequest,
    SMEProfile,
    GrantSchemeMetadata,
    TriggerEventRecord,
    SubmittedGrantDBRecord,
    CrawlTriggerResponse,
    OpportunityScanResponse,
    ScheduledScanResponse,
    AuditEventRecord,
    OrgAuditLogResponse,
    SessionEventRequest,
    ClaimSubmitRequest,
    ClaimSubmitResponse,
    ClaimSummary,
    PasswordChangeRequest,
    ProfileImpactResponse,
    DocumentKind,
    DocumentSource,
)
from app.services.audit_service import (
    AuditContext,
    actor_label,
    account_email,
    last_event,
    list_org_events,
    recently_recorded,
    record_event,
)
from app.services.evaluator import evaluate_claim_package, generate_dossier_packet
from app.services.llm_service import parse_raw_invoice
from app.services.opportunity_service import scan_profile, describe_scan
from app.services.profile_service import normalize_profile, profile_impact, validate_profile
from app.services.db_service import (
    list_organizations,
    get_organization,
    register_organization,
    login_organization,
    update_organization_profile,
    list_grant_schemes,
    save_org_claim,
    list_submitted_grants,
    save_submitted_grant,
    log_trigger_event,
    list_trigger_events,
    init_db,
    get_org_claim,
    get_latest_org_claim,
    list_org_claims,
    find_org_id_by_email,
    change_organization_password,
)
from datetime import datetime, timezone

router = APIRouter()


def _load_scenarios() -> List[DemoScenario]:
    scenarios_path = Path(__file__).resolve().parents[2] / "data" / "scenarios.json"
    if not scenarios_path.exists():
        return []
    with open(scenarios_path, "r") as f:
        data = json.load(f)
    return [DemoScenario.model_validate(s) for s in data]


@router.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "Autonomous SME GrantFlow & Claim Engine",
        "database": "Neon Postgres + Local Mirror Active",
    }


# 1. Preset Scenarios API
@router.get("/scenarios", response_model=List[DemoScenario])
def list_scenarios():
    """Lists pre-configured Malaysian SME demo scenarios for 1-click frontend testing."""
    return _load_scenarios()


@router.get("/scenarios/{scenario_id}", response_model=DemoScenario)
def get_scenario(scenario_id: str):
    """Retrieves a specific demo scenario by ID."""
    scenarios = _load_scenarios()
    for s in scenarios:
        if s.id == scenario_id:
            return s
    raise HTTPException(status_code=404, detail=f"Scenario '{scenario_id}' not found")


# 2. Organization Auth & SSM Profile API (Neon Postgres Backed)
@router.get("/organizations", response_model=List[OrganizationAccount])
def get_all_organizations():
    """Lists all registered SME organizations from Neon Postgres."""
    return list_organizations()


@router.get("/organizations/{org_id}", response_model=OrganizationAccount)
def get_single_organization(org_id: str):
    org = get_organization(org_id)
    if not org:
        raise HTTPException(status_code=404, detail=f"Organization '{org_id}' not found")
    return org


@router.post("/auth/register", response_model=OrganizationAccount)
def register_org_endpoint(payload: OrganizationRegisterRequest, request: Request):
    """Registers a new SME organization and runs a year-round profile opportunity scan."""
    _raise_if_invalid(payload.company)
    org = register_organization(payload.model_copy(update={"company": normalize_profile(payload.company)}))
    record_event(
        org.id,
        "ORG_REGISTERED",
        f"Organization registered: {org.company.companyName}",
        f"SSM {org.company.registrationNumber}, {org.company.malaysianEquityPercentage:.0f}% Malaysian equity.",
        ctx=AuditContext.from_request(request),
    )
    scan = scan_profile(org.id, org.company, trigger_source="ORG_PROFILE_UPDATED")
    log_trigger_event(
        org_id=org.id,
        trigger_type="ORG_PROFILE_UPDATED",
        title="New SME Organization Registered (SSM Synced)",
        description=(
            f"Registered {org.company.companyName} (SSM {org.company.registrationNumber}) with "
            f"{org.company.malaysianEquityPercentage:.0f}% Malaysian equity. {describe_scan(org.company, scan)}"
        ),
        grants_evaluated=len(scan.matches),
        grants_matched=scan.eligibleCount,
    )
    return org


@router.post("/auth/login", response_model=OrganizationAccount)
def login_org_endpoint(payload: OrganizationLoginRequest, request: Request):
    """Signs in an SME organization by email. Successful and failed attempts are audited with the client IP."""
    ctx = AuditContext.from_request(request)
    org = login_organization(payload)
    if not org:
        # Only attempts against a known account can be attributed to an organization's log.
        known_org_id = find_org_id_by_email(payload.email)
        if known_org_id:
            record_event(
                known_org_id,
                "LOGIN_FAILED",
                "Failed sign-in attempt",
                "Incorrect password.",
                ctx=ctx,
                actor_email=payload.email.lower().strip(),
            )
        raise HTTPException(status_code=401, detail="Invalid organization email or password")
    record_event(org.id, "LOGIN", "Signed in", f"Company account {org.email} signed in.", ctx=ctx)
    return org


@router.post("/auth/session", response_model=AuditEventRecord)
def record_session_endpoint(payload: SessionEventRequest, request: Request):
    """Audits a resumed session (page load) or a switch to another organization."""
    org = get_organization(payload.orgId)
    if not org:
        raise HTTPException(status_code=404, detail=f"Organization '{payload.orgId}' not found")
    if payload.reason == "SWITCH":
        return record_event(
            org.id, "ORG_SWITCHED", f"Switched to {org.company.companyName}",
            "Organization selected from the account switcher.", ctx=AuditContext.from_request(request),
        )
    ctx = AuditContext.from_request(request)
    # Page reloads within a minute from the same IP are the same visit; log them once.
    if recently_recorded(org.id, "SESSION_RESUMED", 60, ctx.ip_address):
        return last_event(org.id)
    return record_event(
        org.id, "SESSION_RESUMED", "Session resumed",
        "Saved session restored on page load.", ctx=ctx,
    )


def _raise_if_invalid(company: SMEProfile) -> None:
    errors = validate_profile(company)
    if errors:
        raise HTTPException(
            status_code=422,
            detail={"message": "Profile has invalid fields", "fieldErrors": [e.model_dump() for e in errors]},
        )


_FIELD_LABEL = {
    "companyName": "Company name",
    "registrationNumber": "SSM registration no.",
    "incorporationDate": "Incorporation date",
    "tenureMonths": "Operating tenure (months)",
    "malaysianEquityPercentage": "Malaysian equity %",
    "annualTurnoverMYR": "Annual turnover (RM)",
    "fullTimeEmployees": "Full-time employees",
    "sector": "Sector",
    "isGlcOrMncOwned": "GLC/MNC owned",
    "isActiveExporter": "Active exporter",
}


@router.post("/organizations/{org_id}/profile/preview", response_model=ProfileImpactResponse)
def preview_org_profile_endpoint(org_id: str, draft: SMEProfile):
    """
    Read-only: validates a draft profile, computes tenure from the incorporation date, and shows which
    year-round grants would start or stop pre-qualifying. Nothing is saved or audited.
    """
    org = get_organization(org_id)
    if not org:
        raise HTTPException(status_code=404, detail=f"Organization '{org_id}' not found")
    return profile_impact(org.company, draft)


@router.put("/organizations/{org_id}/profile", response_model=OrganizationAccount)
def update_org_profile_endpoint(org_id: str, company: SMEProfile, request: Request):
    """Validates and saves the SSM & workforce profile (tenure derived from incorporation date), then re-scans."""
    before = get_organization(org_id)
    if not before:
        raise HTTPException(status_code=404, detail=f"Organization '{org_id}' not found")
    _raise_if_invalid(company)
    impact = profile_impact(before.company, company)
    updated = update_organization_profile(org_id, impact.company)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Organization '{org_id}' not found")
    scan = scan_profile(org_id, updated.company, trigger_source="ORG_PROFILE_UPDATED")

    old, new = before.company.model_dump(mode="json"), updated.company.model_dump(mode="json")
    field_changes = [
        f"{_FIELD_LABEL.get(k, k)}: {old.get(k)} → {new.get(k)}" for k in new if old.get(k) != new.get(k)
    ]
    gained = [c.grantName for c in impact.changes if c.after]
    lost = [c.grantName for c in impact.changes if not c.after]
    effect = f"Pre-qualifies for {scan.eligibleCount} of {len(scan.matches)} schemes."
    if gained:
        effect += f" Now qualifies: {', '.join(gained)}."
    if lost:
        effect += f" No longer qualifies: {', '.join(lost)}."
    record_event(
        org_id,
        "PROFILE_UPDATED",
        "SSM & workforce profile updated",
        ("Changed " + "; ".join(field_changes) + ". " if field_changes else "No field changes. ") + effect,
        ctx=AuditContext.from_request(request),
    )
    log_trigger_event(
        org_id=org_id,
        trigger_type="ORG_PROFILE_UPDATED",
        title="SSM & Workforce Profile Updated",
        description=(
            f"Updated {updated.company.companyName} ({updated.company.malaysianEquityPercentage:.0f}% MY Equity, "
            f"{updated.company.fullTimeEmployees} FTEs, RM {updated.company.annualTurnoverMYR:,.0f} turnover). "
            f"{describe_scan(updated.company, scan)}"
        ),
        grants_evaluated=len(scan.matches),
        grants_matched=scan.eligibleCount,
    )
    return updated


@router.post("/organizations/{org_id}/password", status_code=204)
def change_password_endpoint(org_id: str, payload: PasswordChangeRequest, request: Request):
    """Changes the company account password after verifying the current one. Stored as a scrypt hash."""
    ctx = AuditContext.from_request(request)
    if not get_organization(org_id):
        raise HTTPException(status_code=404, detail=f"Organization '{org_id}' not found")
    if len(payload.newPassword) < 8:
        raise HTTPException(status_code=422, detail="New password must be at least 8 characters.")
    if payload.newPassword == payload.currentPassword:
        raise HTTPException(status_code=422, detail="New password must differ from the current password.")
    if not change_organization_password(org_id, payload.currentPassword, payload.newPassword):
        record_event(org_id, "PASSWORD_CHANGE_FAILED", "Password change rejected", "Current password incorrect.", ctx=ctx)
        raise HTTPException(status_code=403, detail="Current password is incorrect.")
    record_event(org_id, "PASSWORD_CHANGED", "Account password changed", "", ctx=ctx)


# 2b. Year-round Opportunity Scanning (profile-only, no invoice needed)
@router.get("/organizations/{org_id}/opportunities", response_model=OpportunityScanResponse)
def get_org_opportunities(org_id: str):
    """
    Read-only: evaluates the organization's SSM/HR profile against every scheme's company-level
    rules and application window. Does not log a trigger event.
    """
    org = get_organization(org_id)
    if not org:
        raise HTTPException(status_code=404, detail=f"Organization '{org_id}' not found")
    return scan_profile(org_id, org.company, trigger_source="ON_DEMAND")


@router.post("/triggers/scan-opportunities", response_model=OpportunityScanResponse)
def trigger_scan_opportunities(request: Request, org_id: str = Query(...)):
    """Trigger Point 3 (On-demand opportunity scan): profile scan for one org, logged as a trigger event."""
    org = get_organization(org_id)
    if not org:
        raise HTTPException(status_code=404, detail=f"Organization '{org_id}' not found")
    scan = scan_profile(org_id, org.company, trigger_source="PROFILE_OPPORTUNITY_SCAN")
    record_event(
        org_id, "OPPORTUNITY_SCAN", "Year-round opportunity scan run",
        describe_scan(org.company, scan), ctx=AuditContext.from_request(request),
    )
    log_trigger_event(
        org_id=org_id,
        trigger_type="PROFILE_OPPORTUNITY_SCAN",
        title="Year-round Grant Opportunity Scan",
        description=describe_scan(org.company, scan),
        grants_evaluated=len(scan.matches),
        grants_matched=scan.eligibleCount,
    )
    return scan


def run_scheduled_scan() -> ScheduledScanResponse:
    """Scans every organization's profile. Called by the background scheduler or the endpoint below."""
    init_db()
    schemes = list_grant_schemes()
    scans: List[OpportunityScanResponse] = []
    for org in list_organizations():
        scan = scan_profile(org.id, org.company, trigger_source="SCHEDULED_OPPORTUNITY_SCAN", schemes=schemes)
        record_event(
            org.id, "SCHEDULED_OPPORTUNITY_SCAN", "Scheduled opportunity scan",
            describe_scan(org.company, scan), actor_type="SYSTEM",
        )
        log_trigger_event(
            org_id=org.id,
            trigger_type="SCHEDULED_OPPORTUNITY_SCAN",
            title="Scheduled Grant Opportunity Scan",
            description=describe_scan(org.company, scan),
            grants_evaluated=len(scan.matches),
            grants_matched=scan.eligibleCount,
        )
        scans.append(scan)
    return ScheduledScanResponse(
        scannedAt=datetime.now(timezone.utc).isoformat(),
        organizationsScanned=len(scans),
        scans=scans,
    )


@router.post("/triggers/scheduled-scan", response_model=ScheduledScanResponse)
def trigger_scheduled_scan():
    """
    Trigger Point 4 (Periodic audit): scans all organizations against current grant windows.
    Runs automatically every SCHEDULED_SCAN_INTERVAL_HOURS; this endpoint lets a cron job or admin run it.
    """
    return run_scheduled_scan()


# 3. Official Grant Registry & Event-Driven Trigger Points
@router.get("/grants/schemes", response_model=List[GrantSchemeMetadata])
def get_grant_schemes_endpoint():
    """Returns all official Malaysian government grant schemes synced in Neon Postgres."""
    return list_grant_schemes()


@router.post("/triggers/crawl-grants", response_model=CrawlTriggerResponse)
def trigger_crawl_grants(
    payload: Optional[ClaimEvaluationRequest] = None,
    org_id: Optional[str] = Query(default="org-nusantara"),
):
    """
    Trigger Point 1 (Periodic / On-Demand Grant Crawler):
    Crawls & syncs official Malaysian grant portals (MDEC, SME Corp, MATRADE, HRD Corp, MIDA, MITI, Cradle Fund)
    into Neon Postgres, runs a year-round profile opportunity scan for the organization, and optionally
    re-evaluates the supplied claim deterministically.
    """
    known_ids = {s.grantId for s in list_grant_schemes()}
    init_db()
    schemes = list_grant_schemes()
    newly_discovered = sum(1 for s in schemes if s.grantId not in known_ids)
    updated_claim: Optional[ClaimsReadinessPackage] = None
    matched_count = 0
    target_org_id = org_id or "org-nusantara"

    if payload is not None:
        updated_claim = evaluate_claim_package(payload.company, payload.invoice)
        matched_count = sum(1 for e in updated_claim.evaluations if e.isEligible)
        if org_id:
            save_org_claim(org_id, updated_claim, trigger_source="PERIODIC_GRANT_CRAWL")

    opportunities: Optional[OpportunityScanResponse] = None
    org = get_organization(target_org_id)
    profile = payload.company if payload is not None else (org.company if org else None)
    if profile is not None:
        opportunities = scan_profile(target_org_id, profile, trigger_source="PERIODIC_GRANT_CRAWL", schemes=schemes)

    description = (
        f"Verified {len(schemes)} active grant schemes across MDEC, SME Corp, MATRADE, HRD Corp, MIDA, MITI & Cradle Fund."
    )
    if updated_claim is not None:
        description += f" Current invoice matched {matched_count} scheme(s)."
    if opportunities is not None and profile is not None:
        description += f" {describe_scan(profile, opportunities)}"

    # The Grant Hub crawls on every load; keep one discovery entry per org per 10 minutes.
    if not recently_recorded(target_org_id, "GRANT_CRAWL", 600):
        record_event(target_org_id, "GRANT_CRAWL", "Grant portals crawled & synced", description, actor_type="SYSTEM")
    evt = log_trigger_event(
        org_id=target_org_id,
        trigger_type="PERIODIC_GRANT_CRAWL",
        title="Official Malaysian Grant Portals Crawled & Synced",
        description=description,
        grants_evaluated=len(schemes),
        grants_matched=opportunities.eligibleCount if opportunities else matched_count,
    )
    return CrawlTriggerResponse(
        syncedCount=len(schemes),
        newlyDiscoveredCount=newly_discovered,
        schemes=schemes,
        triggerEvent=evt,
        updatedClaim=updated_claim,
        opportunities=opportunities,
    )


_DOC_LABEL = {
    DocumentKind.INVOICE: "invoice",
    DocumentKind.QUOTATION: "quotation",
    DocumentKind.RECEIPT: "receipt",
}
_SOURCE_LABEL = {
    DocumentSource.PRESET: "sample preset selected",
    DocumentSource.UPLOAD: "file uploaded, fields confirmed by user",
    DocumentSource.OCR_TEXT: "pasted text parsed by AI, fields confirmed by user",
    DocumentSource.MANUAL: "entered manually",
    DocumentSource.STORED: "stored document re-evaluated",
}


@router.post("/triggers/submit-invoice", response_model=ClaimsReadinessPackage)
def trigger_submit_invoice(
    payload: ClaimEvaluationRequest,
    request: Request,
    org_id: Optional[str] = Query(default="org-nusantara"),
):
    """
    Trigger Point 2 (New Document Submission):
    Persists the invoice/quotation/receipt for the organization, evaluates all 7 grant rules deterministically,
    and audits who submitted which document, how it entered the system, and for which programme.
    """
    ctx = AuditContext.from_request(request)
    kind_label = _DOC_LABEL[payload.documentKind]
    source = payload.documentSource or DocumentSource.MANUAL
    inv = payload.invoice
    target = f" for {payload.targetGrantId}" if payload.targetGrantId else ""
    ingest_action = (
        f"{kind_label.capitalize()} #{inv.invoiceNumber} submitted{target} "
        f"(RM {inv.totalAmountMYR:,.2f}, {inv.vendorName}; {_SOURCE_LABEL[source]})"
    )

    # The saved profile is the source of truth: a stale company snapshot in the request (e.g. from an older
    # claim) must not overwrite profile edits. Profiles change only through PUT /profile.
    stored_org = get_organization(org_id) if org_id else None
    company = stored_org.company if stored_org else normalize_profile(payload.company)
    if stored_org:
        update_organization_profile(org_id, company, payload.invoice)
    pkg = evaluate_claim_package(
        company,
        payload.invoice,
        ingest_action=ingest_action,
        ingested_by=actor_label(org_id, ctx),
        ip_address=ctx.ip_address,
    )
    eligible_count = sum(1 for e in pkg.evaluations if e.isEligible)
    if org_id:
        save_org_claim(org_id, pkg, trigger_source="NEW_INVOICE_SUBMITTED")
        record_event(org_id, "DOCUMENT_SUBMITTED", ingest_action, "", ctx=ctx, claim_id=pkg.claimId)
        target_eval = next((e for e in pkg.evaluations if e.grantId == payload.targetGrantId), None)
        outcome = (
            f" Target {target_eval.grantName}: {'passed' if target_eval.isEligible else 'not met'}."
            if target_eval
            else ""
        )
        record_event(
            org_id,
            "CLAIM_EVALUATED",
            f"Claim {pkg.claimId} evaluated",
            f"{eligible_count} of {len(pkg.evaluations)} schemes eligible, RM {pkg.totalClaimableAmountMYR:,.2f} claimable.{outcome}",
            actor_type="SYSTEM",
            claim_id=pkg.claimId,
        )
    log_trigger_event(
        org_id=org_id or "org-nusantara",
        trigger_type="NEW_INVOICE_SUBMITTED",
        title=f"New {kind_label.capitalize()} #{inv.invoiceNumber} Triggered Evaluation",
        description=f"Evaluated RM {inv.totalAmountMYR:,.2f} expenditure from {inv.vendorName} across {len(pkg.evaluations)} schemes ({eligible_count} eligible).",
        grants_evaluated=len(pkg.evaluations),
        grants_matched=eligible_count,
    )
    return pkg


@router.get("/triggers", response_model=List[TriggerEventRecord])
def get_triggers_endpoint(org_id: Optional[str] = Query(default=None)):
    """Lists recent event-driven trigger logs from Neon Postgres."""
    return list_trigger_events(org_id)


# 4. Organization Audit Log (append-only, hash-chained)
@router.get("/organizations/{org_id}/audit-events", response_model=OrgAuditLogResponse)
def get_org_audit_events(org_id: str, limit: int = Query(default=200, ge=1, le=1000)):
    """All audited activity for an organization, newest first, with a hash-chain integrity check."""
    if not get_organization(org_id):
        raise HTTPException(status_code=404, detail=f"Organization '{org_id}' not found")
    return list_org_events(org_id, limit=limit)


# 5. Submitted Grants Persistence (Neon Postgres)
@router.get("/organizations/{org_id}/submitted-grants", response_model=List[SubmittedGrantDBRecord])
def get_org_submitted_grants(org_id: str):
    """Lists all submitted & claimed grants for an organization from Neon Postgres."""
    return list_submitted_grants(org_id)


@router.post("/organizations/{org_id}/submitted-grants", response_model=SubmittedGrantDBRecord)
def create_org_submitted_grant(org_id: str, record: SubmittedGrantDBRecord, request: Request):
    """
    Legacy direct save of a submitted grant. Prefer POST /claims/{claim_id}/submit, which builds the record
    from the server's approved claim.
    """
    record.orgId = org_id
    saved = save_submitted_grant(record)
    record_event(
        org_id,
        "GRANT_SUBMITTED",
        f"Grant claim submitted: {record.grantName}",
        f"Claim {record.claimId}, RM {record.claimableAmountMYR:,.2f} (recorded via legacy endpoint).",
        ctx=AuditContext.from_request(request),
        claim_id=record.claimId,
    )
    log_trigger_event(
        org_id=org_id,
        trigger_type="GRANT_SUBMITTED",
        title=f"Official Grant Claim Submitted: {record.agency}",
        description=f"Submitted {record.grantName} (Claim {record.claimId}) for RM {record.claimableAmountMYR:,.2f} matching funds.",
        grants_evaluated=1,
        grants_matched=1,
    )
    return saved


# 6. Raw Unstructured Invoice Parsing API (DeepSeek Powered)
@router.post("/invoices/parse-raw", response_model=Invoice)
def parse_raw_invoice_endpoint(
    payload: RawInvoiceParseRequest,
    request: Request,
    org_id: Optional[str] = Query(default=None),
):
    """
    Parses messy raw text or OCR invoice copy using DeepSeek AI.
    Extracts vendor, amount, line items, and classifies grant categories automatically.
    """
    try:
        parsed = parse_raw_invoice(payload.rawText, payload.vendorNameHint)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Invoice parsing failed: {str(e)}")
    if org_id and get_organization(org_id):
        record_event(
            org_id,
            "DOCUMENT_AI_PARSED",
            f"Document text parsed by AI: #{parsed.invoiceNumber}",
            f"{len(payload.rawText)} characters extracted to {parsed.vendorName}, RM {parsed.totalAmountMYR:,.2f}, "
            f"{len(parsed.items)} line item(s). Fields still require user confirmation.",
            actor_type="AI",
            actor_email=account_email(org_id),
        )
    return parsed


# 7. Claims Evaluation & Human-in-the-Loop Approval
@router.get("/organizations/{org_id}/claims/latest", response_model=ClaimsReadinessPackage)
def get_latest_claim_endpoint(org_id: str):
    """Most recently updated saved claim for the organization, so a page reload keeps its audit trail."""
    pkg = get_latest_org_claim(org_id)
    if not pkg:
        raise HTTPException(status_code=404, detail=f"No saved claim for organization '{org_id}'")
    return pkg


@router.get("/organizations/{org_id}/claims", response_model=List[ClaimSummary])
def list_org_claims_endpoint(org_id: str, limit: int = Query(default=100, ge=1, le=500)):
    """The organization's saved claims, most recently updated first, for the audit trail claim picker."""
    if not get_organization(org_id):
        raise HTTPException(status_code=404, detail=f"Organization '{org_id}' not found")
    return [
        ClaimSummary(
            claimId=pkg.claimId,
            status=pkg.status,
            documentNumber=pkg.invoice.invoiceNumber,
            vendorName=pkg.invoice.vendorName,
            documentAmountMYR=pkg.invoice.totalAmountMYR,
            totalClaimableAmountMYR=pkg.totalClaimableAmountMYR,
            eligibleGrantCount=sum(1 for e in pkg.evaluations if e.isEligible),
            auditEventCount=len(pkg.auditTrail),
            triggerSource=source,
            createdAt=pkg.auditTrail[0].timestamp if pkg.auditTrail else pkg.timestamp,
            updatedAt=updated_at,
        )
        for pkg, source, updated_at in list_org_claims(org_id, limit)
    ]


@router.get("/organizations/{org_id}/claims/{claim_id}", response_model=ClaimsReadinessPackage)
def get_org_claim_endpoint(org_id: str, claim_id: str):
    """One saved claim, only if it belongs to the organization."""
    stored = get_org_claim(claim_id)
    if not stored or stored[0] != org_id:
        raise HTTPException(status_code=404, detail=f"Claim '{claim_id}' not found for organization '{org_id}'")
    return stored[1]


@router.post("/claims/evaluate", response_model=ClaimsReadinessPackage)
def evaluate_claim(
    payload: ClaimEvaluationRequest,
    request: Request,
    org_id: Optional[str] = Query(default=None),
    generate_ai: bool = Query(default=False),
):
    """
    Ingests SME profile + invoice, evaluates deterministic rules across all 7 schemes,
    calculates multi-agency grant stacking, drafts narratives (deterministic template or cache),
    and returns package with zero wasted cloud AI tokens during routine evaluations.
    """
    ctx = AuditContext.from_request(request)
    stored_org = get_organization(org_id) if org_id else None
    company = stored_org.company if stored_org else payload.company
    try:
        pkg = evaluate_claim_package(
            company,
            payload.invoice,
            generate_ai=generate_ai,
            ingested_by=actor_label(org_id, ctx) if org_id else "System re-evaluation",
            ip_address=ctx.ip_address if org_id else None,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    if org_id:
        save_org_claim(org_id, pkg, trigger_source="EVALUATE")
        record_event(
            org_id,
            "CLAIM_EVALUATED",
            f"Claim {pkg.claimId} re-evaluated",
            f"Stored invoice #{pkg.invoice.invoiceNumber}: {sum(1 for e in pkg.evaluations if e.isEligible)} of "
            f"{len(pkg.evaluations)} schemes eligible, RM {pkg.totalClaimableAmountMYR:,.2f} claimable.",
            ctx=ctx,
            claim_id=pkg.claimId,
        )
    return pkg


def _stored_claim_or(claim_id: str, fallback: Optional[ClaimsReadinessPackage]):
    """Returns (org_id, server copy of the claim). Falls back to the client copy only if never saved."""
    stored = get_org_claim(claim_id)
    if stored:
        return stored
    if fallback is None:
        raise HTTPException(status_code=404, detail=f"Claim '{claim_id}' not found")
    return None, fallback


@router.post("/claims/{claim_id}/approve", response_model=ClaimsReadinessPackage)
def approve_claim(
    claim_id: str,
    package: ClaimsReadinessPackage,
    request: Request,
    org_id: Optional[str] = Query(default=None),
):
    """
    Step 4 Human Approval. The server's saved claim is authoritative: only the human-edited narratives are
    taken from the request, and the audit entries are written here, never by the browser.
    """
    ctx = AuditContext.from_request(request)
    stored_org_id, base = _stored_claim_or(claim_id, package)
    owner = stored_org_id or org_id
    if base.status != "EVALUATED":
        return base  # already signed off; approving twice must not add a second sign-off

    now = datetime.now(timezone.utc).isoformat()
    actor = actor_label(owner, ctx)
    eligible_ids = {e.grantId for e in base.evaluations if e.isEligible}
    original = {n.grantId: n for n in base.narratives}
    edited = []
    for n in package.narratives:
        if n.grantId in eligible_ids and original.get(n.grantId) != n:
            edited.append(n.grantId)
            original[n.grantId] = n
    base.narratives = [original[n.grantId] for n in base.narratives if n.grantId in original]

    for gid in edited:
        base.auditTrail.append(AuditEntry(
            action=f"AI-drafted narrative for {gid} edited by the reviewer before sign-off",
            timestamp=now, performedBy=actor, eventType="NARRATIVE_EDITED", ipAddress=ctx.ip_address,
        ))
    base.auditTrail.append(AuditEntry(
        action=f"Claim {claim_id} approved and signed off for RM {base.totalClaimableAmountMYR:,.2f} co-funding",
        timestamp=now, performedBy=actor, eventType="CLAIM_APPROVED", ipAddress=ctx.ip_address,
    ))
    base.status = "APPROVED"

    if owner:
        save_org_claim(owner, base, trigger_source="HUMAN_APPROVED")
        for gid in edited:
            record_event(owner, "NARRATIVE_EDITED", f"Narrative edited: {gid}", f"Claim {claim_id}.", ctx=ctx, claim_id=claim_id)
        record_event(
            owner, "CLAIM_APPROVED", f"Claim {claim_id} approved and signed off",
            f"RM {base.totalClaimableAmountMYR:,.2f} across {len(eligible_ids)} grant(s); {len(edited)} narrative(s) edited.",
            ctx=ctx, claim_id=claim_id,
        )
    return base


@router.post("/claims/{claim_id}/submit", response_model=ClaimSubmitResponse)
def submit_claim(claim_id: str, payload: ClaimSubmitRequest, request: Request):
    """
    Records the submission of an approved claim's grants. Builds the submitted-grant records from the server's
    approved claim (engine-computed amounts), appends the audit entry, and saves status SUBMITTED once every
    eligible grant is submitted.
    """
    ctx = AuditContext.from_request(request)
    stored = get_org_claim(claim_id)
    if not stored:
        raise HTTPException(status_code=404, detail=f"Claim '{claim_id}' not found")
    owner, claim = stored
    if claim.status == "EVALUATED":
        raise HTTPException(status_code=409, detail="Claim must be approved and signed off before submission")

    eligible = [e for e in claim.evaluations if e.isEligible]
    already = {r.grantId for r in list_submitted_grants(owner) if r.claimId == claim_id}
    wanted = set(payload.grantIds) if payload.grantIds else {e.grantId for e in eligible}
    to_submit = [e for e in eligible if e.grantId in wanted and e.grantId not in already]

    now = datetime.now(timezone.utc).isoformat()
    actor = actor_label(owner, ctx)
    hash_note = f" Packet SHA-256 {payload.verificationHash}." if payload.verificationHash else ""
    if to_submit:
        claim.auditTrail.append(AuditEntry(
            action=(
                f"Application packet exported & submitted for {', '.join(e.grantName for e in to_submit)} "
                f"(RM {sum(e.maxCoFundingMYR for e in to_submit):,.2f}).{hash_note}"
            ),
            timestamp=now, performedBy=actor, eventType="GRANT_SUBMITTED", ipAddress=ctx.ip_address,
        ))
    if already | {e.grantId for e in to_submit} >= {e.grantId for e in eligible}:
        claim.status = "SUBMITTED"
    save_org_claim(owner, claim, trigger_source="SUBMITTED")

    records: List[SubmittedGrantDBRecord] = []
    for e in to_submit:
        rec = SubmittedGrantDBRecord(
            id=f"{owner}-{claim_id}-{e.grantId}",
            orgId=owner,
            claimId=claim_id,
            grantId=e.grantId,
            grantName=e.grantName,
            agency=e.agency,
            claimableAmountMYR=e.maxCoFundingMYR,
            matchingPercentage=e.matchingPercentage,
            invoiceNumber=claim.invoice.invoiceNumber,
            vendorName=claim.invoice.vendorName,
            submittedAt=now,
            claimSnapshot=claim,
        )
        save_submitted_grant(rec)
        records.append(rec)
        record_event(
            owner, "GRANT_SUBMITTED", f"Grant claim submitted: {e.grantName}",
            f"Claim {claim_id}, RM {e.maxCoFundingMYR:,.2f} co-funding.{hash_note}", ctx=ctx, claim_id=claim_id,
        )
        log_trigger_event(
            org_id=owner,
            trigger_type="GRANT_SUBMITTED",
            title=f"Official Grant Claim Submitted: {e.agency}",
            description=f"Submitted {e.grantName} (Claim {claim_id}) for RM {e.maxCoFundingMYR:,.2f} matching funds.",
            grants_evaluated=1,
            grants_matched=1,
        )
    return ClaimSubmitResponse(claim=claim, records=records)


# 8. Official Submission Packet & Dossier Export
@router.post("/claims/export-dossier", response_model=DossierExportResponse)
def export_dossier(
    package: ClaimsReadinessPackage,
    request: Request,
    org_id: Optional[str] = Query(default=None),
):
    """
    Generates official, submission-ready printable application dossier with SHA-256 audit verification.
    Rendered from the server's saved claim when one exists, so the dossier cannot carry a forged trail.
    """
    stored_org_id, claim = _stored_claim_or(package.claimId, package)
    try:
        dossier = generate_dossier_packet(claim)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    owner = stored_org_id or org_id
    if owner:
        # Opening the packet regenerates it; log once per claim stage (not on every re-render or re-open).
        prev = last_event(owner, claim.claimId)
        if not (prev and prev.eventType in ("PACKET_GENERATED", "GRANT_SUBMITTED")):
            record_event(
                owner, "PACKET_GENERATED", f"Application packet generated for {claim.claimId}",
                f"SHA-256 {dossier.verificationHash}.", ctx=AuditContext.from_request(request), claim_id=claim.claimId,
            )
    return dossier
