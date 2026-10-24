"""Year-round, invoice-free grant opportunity scanning."""
from datetime import date

from fastapi.testclient import TestClient

from app.main import app
from app.models.schemas import (
    ApplicationMode,
    GrantSchemeMetadata,
    Invoice,
    SMEProfile,
    SectorType,
    WindowStatus,
)
from app.rules import ALL_GRANT_RULES, RULES_BY_ID
from app.services.opportunity_service import scan_profile, window_status

client = TestClient(app)

MFG = SMEProfile(
    companyName="Penang Precision Robotics Sdn Bhd",
    registrationNumber="201801029384",
    incorporationDate="2018-06-10",
    tenureMonths=88,
    malaysianEquityPercentage=70.0,
    annualTurnoverMYR=6500000.0,
    fullTimeEmployees=45,
    sector=SectorType.MANUFACTURING,
    isGlcOrMncOwned=False,
    isActiveExporter=True,
)

RETAIL = SMEProfile(
    companyName="Nusantara Retail Solutions Sdn Bhd",
    registrationNumber="202101045892",
    incorporationDate="2021-04-15",
    tenureMonths=42,
    malaysianEquityPercentage=85.0,
    annualTurnoverMYR=480000.0,
    fullTimeEmployees=8,
    sector=SectorType.SERVICES,
)


def _scheme(grant_id: str, mode: ApplicationMode, opens=None, closes=None, active=True) -> GrantSchemeMetadata:
    return GrantSchemeMetadata(
        grantId=grant_id,
        grantName=grant_id,
        agency="X",
        matchingPercentage=50,
        maxCoFundingMYR=1.0,
        sourceUrl="https://example.gov.my",
        criteriaSummary="",
        isActive=active,
        lastCrawledAt="2026-10-01T00:00:00Z",
        applicationMode=mode,
        opensAt=opens,
        closesAt=closes,
    )


# --- Profile stage of the rules ---------------------------------------------------------------

def test_profile_checks_need_no_invoice_and_exclude_invoice_rules():
    invoice_rule_names = {
        "Approved Technology Solution Provider (TSP)",
        "Digital Category Incurred",
        "Automation Hardware / Workflow Scope",
        "Export Promotion Expenditure Scope",
    }
    for rule in ALL_GRANT_RULES:
        eligible, checks = rule.evaluate_profile(MFG)
        assert checks, f"{rule.grant_id} has no profile checks"
        assert not invoice_rule_names & {c.ruleName for c in checks}
        assert rule.eligible_categories, f"{rule.grant_id} lists no fundable categories"


def test_full_evaluation_still_combines_profile_and_invoice_checks():
    empty = Invoice(invoiceNumber="X", invoiceDate="2026-10-01", vendorName="V", totalAmountMYR=0)
    result = RULES_BY_ID["SME_CORP_SAG"].evaluate(MFG, empty)
    names = [c.ruleName for c in result.checks]
    assert "Malaysian Equity Ownership" in names
    assert "Automation Hardware / Workflow Scope" in names
    assert result.isEligible is False  # profile passes, but no automation spend on the invoice
    assert result.maxCoFundingMYR == 0.0


def test_manufacturer_pre_qualifies_without_any_invoice():
    expected = {"SME_CORP_SAG", "MATRADE_MDG", "HRD_CORP_SBL", "MIDA_DISF", "MITI_INDUSTRY4WRD", "MDEC_MSME_DIGITAL"}
    for gid in expected:
        assert RULES_BY_ID[gid].evaluate_profile(MFG)[0] is True, gid
    # 88 months is outside Cradle's 6–36 month early-stage window
    assert RULES_BY_ID["CRADLE_CIP_SPARK"].evaluate_profile(MFG)[0] is False


def test_small_services_firm_profile_gaps():
    assert RULES_BY_ID["MDEC_MSME_DIGITAL"].evaluate_profile(RETAIL)[0] is True
    assert RULES_BY_ID["SME_CORP_SAG"].evaluate_profile(RETAIL)[0] is True
    assert RULES_BY_ID["HRD_CORP_SBL"].evaluate_profile(RETAIL)[0] is False  # 8 FTEs < 10
    assert RULES_BY_ID["MATRADE_MDG"].evaluate_profile(RETAIL)[0] is False  # not an exporter
    assert RULES_BY_ID["MIDA_DISF"].evaluate_profile(RETAIL)[0] is False  # services, < RM500k


def test_mida_capex_threshold_still_enforced_on_claim():
    from app.models.schemas import InvoiceLineItem, InvoiceItemCategory

    small = Invoice(
        invoiceNumber="A", invoiceDate="2026-10-01", vendorName="V", totalAmountMYR=100000,
        items=[InvoiceLineItem(id="1", description="Cobot", category=InvoiceItemCategory.AUTOMATION_HARDWARE,
                               unitPriceMYR=100000, totalPriceMYR=100000)],
    )
    big = small.model_copy(update={"items": [small.items[0].model_copy(update={"totalPriceMYR": 300000})]})
    assert RULES_BY_ID["MIDA_DISF"].evaluate(MFG, small).isEligible is False
    res = RULES_BY_ID["MIDA_DISF"].evaluate(MFG, big)
    assert res.isEligible is True
    assert res.maxCoFundingMYR == 180000.0  # 60% of 300k, under 500k cap


# --- Application windows ------------------------------------------------------------------------

def test_window_status_transitions():
    today = date(2026, 10, 23)
    assert window_status(_scheme("A", ApplicationMode.ROLLING), today)[0] == WindowStatus.OPEN
    assert window_status(_scheme("A", ApplicationMode.ROLLING, active=False), today)[0] == WindowStatus.CLOSED
    assert window_status(None, today)[0] == WindowStatus.CLOSED

    upcoming = window_status(_scheme("A", ApplicationMode.WINDOWED, "2026-11-02", "2027-01-31"), today)
    assert upcoming == (WindowStatus.UPCOMING, None, 10)

    closing = window_status(_scheme("A", ApplicationMode.WINDOWED, "2026-07-01", "2026-11-06"), today)
    assert closing == (WindowStatus.CLOSING_SOON, 14, None)

    open_ = window_status(_scheme("A", ApplicationMode.WINDOWED, "2026-07-01", "2026-12-31"), today)
    assert open_ == (WindowStatus.OPEN, 69, None)

    closed = window_status(_scheme("A", ApplicationMode.WINDOWED, "2026-01-01", "2026-10-22"), today)
    assert closed[0] == WindowStatus.CLOSED


def test_scan_profile_sorting_counts_and_next_steps():
    today = date(2026, 10, 23)
    schemes = [
        _scheme("MDEC_MSME_DIGITAL", ApplicationMode.ROLLING),
        _scheme("SME_CORP_SAG", ApplicationMode.WINDOWED, "2026-07-01", "2026-11-01"),  # closing soon
        _scheme("MATRADE_MDG", ApplicationMode.ROLLING),
        _scheme("HRD_CORP_SBL", ApplicationMode.ROLLING),
        _scheme("MIDA_DISF", ApplicationMode.WINDOWED, "2026-01-01", "2026-06-30"),  # closed
        _scheme("MITI_INDUSTRY4WRD", ApplicationMode.WINDOWED, "2027-01-05", "2027-03-31"),  # upcoming
        _scheme("CRADLE_CIP_SPARK", ApplicationMode.ROLLING),
    ]
    scan = scan_profile("org-test", MFG, "TEST", today=today, schemes=schemes)

    assert len(scan.matches) == 7
    assert scan.eligibleCount == 6
    # Eligible and accepting now: MDEC, SAG, MATRADE, HRD (MIDA closed, MITI upcoming)
    assert scan.openNowCount == 4
    assert scan.potentialCoFundingMYR == 5000 + 1000000 + 300000 + 25000

    ids = [m.grantId for m in scan.matches]
    assert ids[0] == "SME_CORP_SAG"  # closing soon sorts first
    assert ids[-1] == "CRADLE_CIP_SPARK"  # ineligible sorts last

    by_id = {m.grantId: m for m in scan.matches}
    assert by_id["MITI_INDUSTRY4WRD"].nextStep.startswith("Opens in 74 days")
    assert "window is closed" in by_id["MIDA_DISF"].nextStep
    cradle_step = by_id["CRADLE_CIP_SPARK"].nextStep
    assert cradle_step.startswith("Not yet eligible (Early-Stage Startup Tenure Window")
    assert "Revenue Ceiling" in cradle_step  # RM 6.5M also exceeds the RM 5M ceiling
    assert by_id["SME_CORP_SAG"].daysUntilClose == 9


# --- Endpoints ----------------------------------------------------------------------------------

def test_grant_schemes_expose_timing_metadata():
    schemes = client.get("/api/v1/grants/schemes").json()
    by_id = {s["grantId"]: s for s in schemes}
    assert by_id["MATRADE_MDG"]["applicationMode"] == "ROLLING"
    assert by_id["SME_CORP_SAG"]["applicationMode"] == "WINDOWED"
    assert by_id["SME_CORP_SAG"]["opensAt"] and by_id["SME_CORP_SAG"]["closesAt"]
    assert "AUTOMATION_HARDWARE" in by_id["SME_CORP_SAG"]["eligibleCategories"]


def test_get_opportunities_endpoint_is_profile_only():
    res = client.get("/api/v1/organizations/org-precision-mfg/opportunities")
    assert res.status_code == 200
    data = res.json()
    assert data["orgId"] == "org-precision-mfg"
    assert len(data["matches"]) == 7
    assert data["eligibleCount"] >= 1
    first = data["matches"][0]
    assert first["isProfileEligible"] is True
    assert first["windowStatus"] in {"OPEN", "CLOSING_SOON", "UPCOMING", "CLOSED"}
    assert first["nextStep"]

    assert client.get("/api/v1/organizations/org-does-not-exist/opportunities").status_code == 404


def test_scan_trigger_logs_event_with_real_match_count():
    res = client.post("/api/v1/triggers/scan-opportunities?org_id=org-nusantara")
    assert res.status_code == 200
    scan = res.json()
    events = client.get("/api/v1/triggers?org_id=org-nusantara").json()
    latest = next(e for e in events if e["triggerType"] == "PROFILE_OPPORTUNITY_SCAN")
    assert latest["grantsMatched"] == scan["eligibleCount"]
    assert latest["grantsEvaluated"] == 7


def test_scheduled_scan_covers_all_orgs():
    res = client.post("/api/v1/triggers/scheduled-scan")
    assert res.status_code == 200
    data = res.json()
    orgs = client.get("/api/v1/organizations").json()
    # The scan covers every account, including visitor-registered ones that the public list hides.
    assert data["organizationsScanned"] >= len(orgs)
    assert all(s["triggerSource"] == "SCHEDULED_OPPORTUNITY_SCAN" for s in data["scans"])


def test_crawl_returns_opportunities_without_invoice():
    res = client.post("/api/v1/triggers/crawl-grants?org_id=org-precision-mfg")
    assert res.status_code == 200
    data = res.json()
    assert data["updatedClaim"] is None
    assert data["opportunities"] is not None
    assert data["opportunities"]["orgId"] == "org-precision-mfg"
    assert data["triggerEvent"]["grantsMatched"] == data["opportunities"]["eligibleCount"]
