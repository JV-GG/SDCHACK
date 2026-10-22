from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_evaluate_claim_endpoint():
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
    assert data["totalClaimableAmountMYR"] == 3000.0  # 50% of RM6,000
    assert len(data["evaluations"]) == 3
    assert len(data["narratives"]) >= 1

    # Test approve endpoint
    claim_id = data["claimId"]
    approve_response = client.post(f"/api/v1/claims/{claim_id}/approve", json=data)
    assert approve_response.status_code == 200
    approved_data = approve_response.json()
    assert approved_data["status"] == "APPROVED"
    assert any("approval signed off" in entry["action"] for entry in approved_data["auditTrail"])
