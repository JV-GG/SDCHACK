import json
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
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
)
from app.services.evaluator import evaluate_claim_package, generate_dossier_packet
from app.services.llm_service import parse_raw_invoice
from app.services.opportunity_service import scan_profile, describe_scan
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
        "service": "Autonomous SME Grant Copilot & Claim Engine",
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
def register_org_endpoint(payload: OrganizationRegisterRequest):
    """Registers a new SME organization and runs a year-round profile opportunity scan."""
    org = register_organization(payload)
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
def login_org_endpoint(payload: OrganizationLoginRequest):
    """Signs in an SME organization by email."""
    org = login_organization(payload)
    if not org:
        raise HTTPException(status_code=401, detail="Invalid organization email or password")
    return org


@router.put("/organizations/{org_id}/profile", response_model=OrganizationAccount)
def update_org_profile_endpoint(org_id: str, company: SMEProfile):
    """Updates an organization's SSM & workforce profile in Neon DB and triggers re-evaluation."""
    updated = update_organization_profile(org_id, company)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Organization '{org_id}' not found")
    scan = scan_profile(org_id, updated.company, trigger_source="ORG_PROFILE_UPDATED")
    log_trigger_event(
        org_id=org_id,
        trigger_type="ORG_PROFILE_UPDATED",
        title="SSM & Workforce Profile Updated",
        description=(
            f"Updated {company.companyName} ({company.malaysianEquityPercentage:.0f}% MY Equity, "
            f"{company.fullTimeEmployees} FTEs, RM {company.annualTurnoverMYR:,.0f} turnover). "
            f"{describe_scan(updated.company, scan)}"
        ),
        grants_evaluated=len(scan.matches),
        grants_matched=scan.eligibleCount,
    )
    return updated


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
def trigger_scan_opportunities(org_id: str = Query(...)):
    """Trigger Point 3 (On-demand opportunity scan): profile scan for one org, logged as a trigger event."""
    org = get_organization(org_id)
    if not org:
        raise HTTPException(status_code=404, detail=f"Organization '{org_id}' not found")
    scan = scan_profile(org_id, org.company, trigger_source="PROFILE_OPPORTUNITY_SCAN")
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


@router.post("/triggers/submit-invoice", response_model=ClaimsReadinessPackage)
def trigger_submit_invoice(
    payload: ClaimEvaluationRequest,
    org_id: Optional[str] = Query(default="org-nusantara"),
):
    """
    Trigger Point 2 (New Invoice Submission Trigger):
    Persists the new invoice for the organization in Neon DB, evaluates all 7 grant rules deterministically,
    uses cached narratives where possible, and logs a NEW_INVOICE_SUBMITTED trigger event.
    """
    if org_id:
        update_organization_profile(org_id, payload.company, payload.invoice)
    pkg = evaluate_claim_package(payload.company, payload.invoice)
    eligible_count = sum(1 for e in pkg.evaluations if e.isEligible)
    if org_id:
        save_org_claim(org_id, pkg, trigger_source="NEW_INVOICE_SUBMITTED")
    log_trigger_event(
        org_id=org_id or "org-nusantara",
        trigger_type="NEW_INVOICE_SUBMITTED",
        title=f"New Invoice #{payload.invoice.invoiceNumber} Triggered Evaluation",
        description=f"Evaluated RM {payload.invoice.totalAmountMYR:,.2f} expenditure from {payload.invoice.vendorName} across {len(pkg.evaluations)} schemes ({eligible_count} eligible).",
        grants_evaluated=len(pkg.evaluations),
        grants_matched=eligible_count,
    )
    return pkg


@router.get("/triggers", response_model=List[TriggerEventRecord])
def get_triggers_endpoint(org_id: Optional[str] = Query(default=None)):
    """Lists recent event-driven trigger logs from Neon Postgres."""
    return list_trigger_events(org_id)


# 4. Submitted Grants Persistence (Neon Postgres)
@router.get("/organizations/{org_id}/submitted-grants", response_model=List[SubmittedGrantDBRecord])
def get_org_submitted_grants(org_id: str):
    """Lists all submitted & claimed grants for an organization from Neon Postgres."""
    return list_submitted_grants(org_id)


@router.post("/organizations/{org_id}/submitted-grants", response_model=SubmittedGrantDBRecord)
def create_org_submitted_grant(org_id: str, record: SubmittedGrantDBRecord):
    """Saves a newly submitted grant claim into Neon Postgres so it persists across browsers/devices."""
    record.orgId = org_id
    saved = save_submitted_grant(record)
    log_trigger_event(
        org_id=org_id,
        trigger_type="NEW_INVOICE_SUBMITTED",
        title=f"Official Grant Claim Submitted: {record.agency}",
        description=f"Submitted {record.grantName} (Claim {record.claimId}) for RM {record.claimableAmountMYR:,.2f} matching funds.",
        grants_evaluated=1,
        grants_matched=1,
    )
    return saved


# 5. Raw Unstructured Invoice Parsing API (DeepSeek Powered)
@router.post("/invoices/parse-raw", response_model=Invoice)
def parse_raw_invoice_endpoint(payload: RawInvoiceParseRequest):
    """
    Parses messy raw text or OCR invoice copy using DeepSeek AI.
    Extracts vendor, amount, line items, and classifies grant categories automatically.
    """
    try:
        return parse_raw_invoice(payload.rawText, payload.vendorNameHint)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Invoice parsing failed: {str(e)}")


# 6. Claims Evaluation & Human-in-the-Loop Approval
@router.post("/claims/evaluate", response_model=ClaimsReadinessPackage)
def evaluate_claim(
    payload: ClaimEvaluationRequest,
    org_id: Optional[str] = Query(default=None),
    generate_ai: bool = Query(default=False),
):
    """
    Ingests SME profile + invoice, evaluates deterministic rules across all 7 schemes,
    calculates multi-agency grant stacking, drafts narratives (deterministic template or cache),
    and returns package with zero wasted cloud AI tokens during routine evaluations.
    """
    try:
        pkg = evaluate_claim_package(payload.company, payload.invoice, generate_ai=generate_ai)
        if org_id:
            save_org_claim(org_id, pkg, trigger_source="EVALUATE")
        return pkg
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/claims/{claim_id}/approve", response_model=ClaimsReadinessPackage)
def approve_claim(
    claim_id: str,
    package: ClaimsReadinessPackage,
    org_id: Optional[str] = Query(default=None),
):
    """
    Step 4 Human Approval: user signs off on the readiness package.
    """
    package.status = "APPROVED"
    package.auditTrail.append(
        AuditEntry(
            action=f"Human-in-the-Loop approval signed off for claim {claim_id}",
            timestamp=datetime.now(timezone.utc).isoformat(),
            performedBy="Business Owner / Finance Director",
        )
    )
    if org_id:
        save_org_claim(org_id, package, trigger_source="HUMAN_APPROVED")
    return package


# 7. Official Submission Packet & Dossier Export
@router.post("/claims/export-dossier", response_model=DossierExportResponse)
def export_dossier(package: ClaimsReadinessPackage):
    """
    Generates official, submission-ready printable application dossier with SHA-256 audit verification.
    """
    try:
        return generate_dossier_packet(package)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
