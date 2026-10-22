/# Member 2: Backend, Rules Engine & AI Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the FastAPI intelligence engine: deterministic rules engine for Malaysian grants (MDEC, SME Corp, MATRADE), Gemini Flash narrative generation service, and REST API orchestration.

**Architecture:** Python 3 / FastAPI modular service with strict Pydantic schemas. Hybrid decision logic separates zero-hallucination deterministic criteria evaluation from lightweight LLM proposal drafting.

**Tech Stack:** FastAPI, Pydantic 2, Uvicorn, Google Generative AI (Gemini Flash), Pytest.

**Spec:** [README.md](file:///Users/wenfei/Hackathon/SDC Hackathon 2026/SDCHACK/README.md) & [contract/types.ts](file:///Users/wenfei/Hackathon/SDC Hackathon 2026/SDCHACK/contract/types.ts)

## Global Constraints
- **Directory boundary**: Touch ONLY files inside `backend/` (and read `contract/`).
- **Zero hallucination for quantitative criteria**: All equity percentages, SME Corp size caps, turnover, and TSP whitelisting must execute via pure deterministic Python functions—never via LLM prompt guessing.
- **Offline / Zero-Key Resiliency**: The narrative service must function seamlessly via structured template generation if `GEMINI_API_KEY` is absent.
- **Deployment readiness**: Fast startup time and open CORS (`allow_origins=["*"]`) for easy hosting on Replit or Render.

---

### Task 1: Environment & Pydantic Schema Verification

**Files:**
- Test: `backend/tests/test_schemas.py`
- Modify: `backend/app/models/schemas.py`

**Interfaces:**
- Consumes: `contract/mock_claim_package.json`.
- Produces: Validated Pydantic models for `SMEProfile`, `Invoice`, `RuleCheckResult`, `GrantEvaluation`, and `ClaimsReadinessPackage`.

- [ ] **Step 1: Write test for schema serialization**
Create `backend/tests/test_schemas.py` loading `contract/mock_claim_package.json` into `ClaimsReadinessPackage` to ensure 100% contract compliance.

```python
import json
from pathlib import Path
from app.models.schemas import ClaimsReadinessPackage

def test_mock_package_matches_pydantic_schema():
    contract_file = Path(__file__).resolve().parents[2] / "contract" / "mock_claim_package.json"
    with open(contract_file, "r") as f:
        data = json.load(f)
    pkg = ClaimsReadinessPackage.model_validate(data)
    assert pkg.claimId.startswith("CLM-")
    assert pkg.company.malaysianEquityPercentage == 85.0
    assert pkg.totalClaimableAmountMYR == 5000.0
```

- [ ] **Step 2: Run test to verify**
Run: `python3 -m pytest backend/tests/test_schemas.py`
Expected: PASS

- [ ] **Step 3: Commit**
`git add backend/tests/test_schemas.py backend/app/models/schemas.py`
`git commit -m "test(backend): verify Pydantic schemas against shared contract"`

---

### Task 2: Deterministic Rules Engine — MDEC MSME Digital Grant

**Files:**
- Create/Modify: `backend/app/rules/mdec.py`
- Create: `backend/tests/test_mdec_rules.py`

**Interfaces:**
- Consumes: `SMEProfile` and `Invoice`.
- Produces: `GrantEvaluation` with exact pass/fail checks:
  1. Malaysian Equity $\ge 60\%$
  2. Operational Tenure $\ge 6$ months
  3. Annual Turnover $\ge \text{RM } 50,000$
  4. Vendor is accredited MDEC TSP (`vendorIsMdecTsp == True`)
  5. Digital Category Incurred (e-Invoicing, ERP, HR/Payroll)
  - Calculation: 50% matching up to RM 5,000 max cap.

- [ ] **Step 1: Write comprehensive test cases**
Create `backend/tests/test_mdec_rules.py` covering:
- Eligible scenario (passes all 5 rules, yields RM 5,000)
- Ineligible equity failure (< 60% Malaysian ownership)
- Ineligible vendor failure (`vendorIsMdecTsp == False`)
- Ineligible turnover failure (< RM 50,000 turnover)

- [ ] **Step 2: Run test to verify**
Run: `python3 -m pytest backend/tests/test_mdec_rules.py`
Expected: PASS

- [ ] **Step 3: Commit**
`git add backend/app/rules/mdec.py backend/tests/test_mdec_rules.py`
`git commit -m "feat(backend): implement and test MDEC MSME Digital Grant rules"`

---

### Task 3: Deterministic Rules Engine — SME Corp Smart Automation Grant (SAG)

**Files:**
- Create/Modify: `backend/app/rules/sme_corp.py`
- Create: `backend/tests/test_sme_corp_rules.py`

**Interfaces:**
- Consumes: `SMEProfile` and `Invoice`.
- Produces: `GrantEvaluation` for SME Corp SAG:
  1. Malaysian Equity $\ge 51\%$
  2. Operational Tenure $\ge 12$ months
  3. Non-GLC / Non-MNC status (`isGlcOrMncOwned == False`)
  4. SME Corp Sector Ceiling (Services: $\le 75$ FTEs or $\le \text{RM 20M}$; Mfg: $\le 200$ FTEs or $\le \text{RM 50M}$)
  5. Automation Equipment Scope (`AUTOMATION_HARDWARE` items present).

- [ ] **Step 1: Write test cases for SME Corp criteria**
Create `backend/tests/test_sme_corp_rules.py` testing:
- Valid manufacturing automation equipment purchase
- Disqualification when expenditure is only standard SaaS software
- Disqualification when company exceeds SME Corp turnover/FTE cap.

- [ ] **Step 2: Run test to verify**
Run: `python3 -m pytest backend/tests/test_sme_corp_rules.py`
Expected: PASS

- [ ] **Step 3: Commit**
`git add backend/app/rules/sme_corp.py backend/tests/test_sme_corp_rules.py`
`git commit -m "feat(backend): implement and test SME Corp Smart Automation Grant rules"`

---

### Task 4: Deterministic Rules Engine — MATRADE Market Development Grant (MDG)

**Files:**
- Create/Modify: `backend/app/rules/matrade.py`
- Create: `backend/tests/test_matrade_rules.py`

**Interfaces:**
- Consumes: `SMEProfile` and `Invoice`.
- Produces: `GrantEvaluation` for MATRADE MDG:
  1. Malaysian Equity $\ge 60\%$
  2. Operational Tenure $\ge 12$ months
  3. Active Exporter status (`isActiveExporter == True`)
  4. Export Exhibition category (`EXPORT_EXHIBITION` items present)
  - Calculation: 100% reimbursable matching up to RM 300,000 lifetime cap.

- [ ] **Step 1: Write test cases for MATRADE criteria**
Create `backend/tests/test_matrade_rules.py` testing:
- Valid overseas trade fair booth expenditure by registered exporter
- Disqualification when SME is not registered as an active exporter.

- [ ] **Step 2: Run test to verify**
Run: `python3 -m pytest backend/tests/test_matrade_rules.py`
Expected: PASS

- [ ] **Step 3: Commit**
`git add backend/app/rules/matrade.py backend/tests/test_matrade_rules.py`
`git commit -m "feat(backend): implement and test MATRADE MDG rules"`

---

### Task 5: Lightweight LLM Narrative Drafter & Prompt Engineering

**Files:**
- Modify: `backend/app/services/llm_service.py`
- Create: `backend/tests/test_llm_service.py`

**Interfaces:**
- Consumes: `SMEProfile`, `Invoice`, and `GrantEvaluation`.
- Produces: `LLMNarrative` with:
  - `projectTitle`
  - `transformationJustification` (operational bottleneck and reason for investment)
  - `roiAndProductivityProjections` (quantified man-hour savings, margin boost)
  - `marketOrExportReadiness` (for MATRADE)

- [ ] **Step 1: Write unit tests for narrative generation**
Create `backend/tests/test_llm_service.py` verifying:
- Fallback template generator produces domain-accurate, professional narratives without API keys.
- If `GEMINI_API_KEY` is present, parses JSON output correctly.

- [ ] **Step 2: Run test to verify**
Run: `python3 -m pytest backend/tests/test_llm_service.py`
Expected: PASS

- [ ] **Step 3: Commit**
`git add backend/app/services/llm_service.py backend/tests/test_llm_service.py`
`git commit -m "feat(backend): refine LLM narrative prompt and robust template fallback"`

---

### Task 6: Orchestration Engine & REST API Endpoints

**Files:**
- Modify: `backend/app/services/evaluator.py`
- Modify: `backend/app/api/routes.py`
- Create: `backend/tests/test_api.py`

**Interfaces:**
- Consumes: HTTP POST requests with JSON payload.
- Produces: Endpoints:
  - `POST /api/v1/claims/evaluate` $\to$ Returns complete `ClaimsReadinessPackage`
  - `POST /api/v1/claims/{id}/approve` $\to$ Signs off claim and appends to audit trail
  - `GET /api/v1/health` $\to$ Status OK

- [ ] **Step 1: Write API integration tests**
Create `backend/tests/test_api.py` using `fastapi.testclient.TestClient` to send mock payload and assert:
- Status 200 OK
- Correct calculations for MDEC MSME Digital Grant
- Audit trail entries correctly initialized.

- [ ] **Step 2: Run test to verify**
Run: `python3 -m pytest backend/tests/test_api.py`
Expected: PASS

- [ ] **Step 3: Commit**
`git add backend/app/services/evaluator.py backend/app/api/routes.py backend/tests/test_api.py`
`git commit -m "feat(backend): complete orchestration service and REST endpoints"`
