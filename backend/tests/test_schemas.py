import json
from pathlib import Path
from app.models.schemas import ClaimsReadinessPackage

def test_mock_package_matches_pydantic_schema():
    contract_file = Path(__file__).resolve().parents[2] / "contract" / "mock_claim_package.json"
    with open(contract_file, "r") as f:
        data = json.load(f)
    pkg = ClaimsReadinessPackage.model_validate(data)
    assert pkg.claimId == "CLM-2026-MDEC-089"
    assert pkg.company.malaysianEquityPercentage == 85.0
    assert pkg.company.sector == "SERVICES"
    assert pkg.totalClaimableAmountMYR == 5000.0
    assert len(pkg.evaluations) == 2
    assert len(pkg.narratives) == 1
    assert pkg.evaluations[0].isEligible is True
    assert pkg.evaluations[1].isEligible is False
