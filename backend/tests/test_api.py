from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_list_and_get_scenarios():
    response = client.get("/api/v1/scenarios")
    assert response.status_code == 200
    scenarios = response.json()
    assert len(scenarios) >= 4
    first_id = scenarios[0]["id"]

    # Test single scenario endpoint
    single_res = client.get(f"/api/v1/scenarios/{first_id}")
    assert single_res.status_code == 200
    assert single_res.json()["id"] == first_id

    # Test 404
    not_found = client.get("/api/v1/scenarios/non-existent-id")
    assert not_found.status_code == 404

def test_parse_raw_invoice():
    raw_text = """
    TAX INVOICE
    CloudTech Malaysia Sdn Bhd (MDEC TSP #0421)
    Date: 2026-10-18
    Invoice No: INV-9901
    1. LHDN MyInvois Integration & POS Terminal License - RM 6,000.00
    Total Payable: RM 6,000.00
    """
    response = client.post("/api/v1/invoices/parse-raw", json={"rawText": raw_text})
    assert response.status_code == 200
    data = response.json()
    assert data["totalAmountMYR"] == 6000.0
    assert len(data["items"]) >= 1
    assert data["vendorIsMdecTsp"] is True

def test_evaluate_claim_endpoint_with_stacking_and_dossier():
    payload = {
        "company": {
            "companyName": "Nusantara Retail Solutions Sdn Bhd",
            "registrationNumber": "202101045892",
            "incorporationDate": "2021-04-15",
            "tenureMonths": 42,
            "malaysianEquityPercentage": 85.0,
            "annualTurnoverMYR": 480000.0,
            "fullTimeEmployees": 8,
            "sector": "SERVICES",
            "isGlcOrMncOwned": False,
            "isActiveExporter": False
        },
        "invoice": {
            "invoiceNumber": "INV-MDEC-9082",
            "invoiceDate": "2026-10-18",
            "vendorName": "CloudTech Malaysia Sdn Bhd (MDEC TSP #0421)",
            "vendorIsMdecTsp": True,
            "totalAmountMYR": 10000.0,
            "items": [
                {
                    "id": "item-1",
                    "description": "LHDN e-Invoicing Compliance Module",
                    "category": "E_INVOICING",
                    "quantity": 1,
                    "unitPriceMYR": 6000.0,
                    "totalPriceMYR": 6000.0
                }
            ]
        }
    }
    response = client.post("/api/v1/claims/evaluate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["claimId"].startswith("CLM-")
    assert data["status"] == "EVALUATED"
    assert data["totalClaimableAmountMYR"] == 3000.0
    assert data["stackingSummary"] is not None
    assert data["stackingSummary"]["effectiveSubsidyPercentage"] == 30.0

    # Test approve endpoint
    claim_id = data["claimId"]
    approve_response = client.post(f"/api/v1/claims/{claim_id}/approve", json=data)
    assert approve_response.status_code == 200
    approved_data = approve_response.json()
    assert approved_data["status"] == "APPROVED"

    # Test export dossier endpoint
    dossier_res = client.post("/api/v1/claims/export-dossier", json=approved_data)
    assert dossier_res.status_code == 200
    dossier = dossier_res.json()
    assert dossier["claimId"] == claim_id
    assert len(dossier["verificationHash"]) == 64  # SHA-256
    assert "<html" in dossier["dossierHtml"].lower()
    assert "Nusantara Retail Solutions" in dossier["dossierHtml"]


def test_organizations_auth_triggers_and_7_grants():
    # 1. List organizations
    orgs_res = client.get("/api/v1/organizations")
    assert orgs_res.status_code == 200
    orgs = orgs_res.json()
    assert len(orgs) >= 3

    # 2. List 7 official Malaysian grant schemes
    schemes_res = client.get("/api/v1/grants/schemes")
    assert schemes_res.status_code == 200
    schemes = schemes_res.json()
    assert len(schemes) == 7

    # 3. Trigger grant crawl
    crawl_res = client.post("/api/v1/triggers/crawl-grants?org_id=org-nusantara")
    assert crawl_res.status_code == 200
    crawl_data = crawl_res.json()
    assert crawl_data["syncedCount"] == 7
    assert crawl_data["triggerEvent"]["triggerType"] == "PERIODIC_GRANT_CRAWL"

    # 4. Trigger new invoice submission for Penang Precision Robotics (multi-agency manufacturing)
    mfg_org = next(o for o in orgs if o["id"] == "org-precision-mfg")
    inv_trigger_res = client.post(
        "/api/v1/triggers/submit-invoice?org_id=org-precision-mfg",
        json={"company": mfg_org["company"], "invoice": mfg_org["defaultInvoice"]},
    )
    assert inv_trigger_res.status_code == 200
    pkg = inv_trigger_res.json()
    assert len(pkg["evaluations"]) == 7
    eligible_ids = [e["grantId"] for e in pkg["evaluations"] if e["isEligible"]]
    assert "SME_CORP_SAG" in eligible_ids
    assert "HRD_CORP_SBL" in eligible_ids
    assert "MIDA_DISF" in eligible_ids
    assert "MITI_INDUSTRY4WRD" in eligible_ids
    assert "MDEC_MSME_DIGITAL" in eligible_ids
