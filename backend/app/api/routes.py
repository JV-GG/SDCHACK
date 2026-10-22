import json
from pathlib import Path
from typing import List
from fastapi import APIRouter, HTTPException, Response
from app.models.schemas import (
    ClaimEvaluationRequest,
    ClaimsReadinessPackage,
    AuditEntry,
    DemoScenario,
    RawInvoiceParseRequest,
    Invoice,
    DossierExportResponse
)
from app.services.evaluator import evaluate_claim_package, generate_dossier_packet
from app.services.llm_service import parse_raw_invoice
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
    return {"status": "ok", "service": "Autonomous SME Grant Copilot & Claim Engine"}

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

# 2. Raw Unstructured Invoice Parsing API (DeepSeek Powered)
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

# 3. Claims Evaluation & Human-in-the-Loop Approval
@router.post("/claims/evaluate", response_model=ClaimsReadinessPackage)
def evaluate_claim(payload: ClaimEvaluationRequest):
    """
    Ingests SME profile + invoice, evaluates deterministic rules,
    calculates multi-agency grant stacking, drafts narratives, and returns package.
    """
    try:
        return evaluate_claim_package(payload.company, payload.invoice)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/claims/{claim_id}/approve", response_model=ClaimsReadinessPackage)
def approve_claim(claim_id: str, package: ClaimsReadinessPackage):
    """
    Step 4 Human Approval: user signs off on the readiness package.
    """
    package.status = "APPROVED"
    package.auditTrail.append(AuditEntry(
        action=f"Human-in-the-Loop approval signed off for claim {claim_id}",
        timestamp=datetime.now(timezone.utc).isoformat(),
        performedBy="Business Owner / Finance Director"
    ))
    return package

# 4. Official Submission Packet & Dossier Export
@router.post("/claims/export-dossier", response_model=DossierExportResponse)
def export_dossier(package: ClaimsReadinessPackage):
    """
    Generates official, submission-ready printable application dossier with SHA-256 audit verification.
    """
    try:
        return generate_dossier_packet(package)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
