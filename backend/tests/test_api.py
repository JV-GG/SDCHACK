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
