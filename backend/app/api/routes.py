from fastapi import APIRouter, HTTPException
from app.models.schemas import (
    ClaimEvaluationRequest,
    ClaimsReadinessPackage,
    AuditEntry
)
from app.services.evaluator import evaluate_claim_package
from datetime import datetime, timezone

router = APIRouter()

@router.get("/health")
def health_check():
    return {"status": "ok", "service": "Autonomous SME Grant Copilot & Claim Engine"}

@router.post("/claims/evaluate", response_model=ClaimsReadinessPackage)
def evaluate_claim(payload: ClaimEvaluationRequest):
    """
    Ingests SME profile + invoice, evaluates deterministic rules,
    drafts narratives, and returns Claims Readiness Package.
    """
    try:
        return evaluate_claim_package(payload.company, payload.invoice)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/claims/{claim_id}/approve", response_model=ClaimsReadinessPackage)
def approve_claim(claim_id: str, package: ClaimsReadinessPackage):
    """
    Simulates Step 4 Human Approval: user signs off on the readiness package.
    """
    package.status = "APPROVED"
    package.auditTrail.append(AuditEntry(
        action=f"Human-in-the-Loop approval signed off for claim {claim_id}",
        timestamp=datetime.now(timezone.utc).isoformat(),
        performedBy="Business Owner / Finance Director"
    ))
    return package
