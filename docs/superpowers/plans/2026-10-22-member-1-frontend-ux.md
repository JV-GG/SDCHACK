# Member 1: Frontend & Human-in-the-Loop UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Next.js 16 interactive user experience for the Autonomous SME Grant Copilot: Grant Hub Dashboard, Event Ingestion Trigger, Step 4 Human Review Portal with criteria checklists, and Step 5 Submission Bundle Exporter.

**Architecture:** Client-side React/Next.js 16 application with Tailwind CSS. Follows contract-first design against `contract/types.ts` and `contract/mock_claim_package.json`. Develops completely decoupled with zero dependency on the live backend until final hookup.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, Lucide Icons.

**Spec:** [README.md](file:///Users/wenfei/Hackathon/SDC Hackathon 2026/SDCHACK/README.md) & [contract/types.ts](file:///Users/wenfei/Hackathon/SDC Hackathon 2026/SDCHACK/contract/types.ts)

## Global Constraints
- **Directory boundary**: Touch ONLY files inside `frontend/` (and read `contract/`).
- **Zero-backend dependency**: All screens must render immediately using mock data fixtures (`src/lib/mockData.ts`).
- **No external fonts/assets**: Use system fonts and standard SVG/Lucide icons to prevent offline build failures.
- **Strict adherence to the 5-step journey**: UI must visibly demonstrate: (1) Trigger, (2) Connected Ingestion, (3) Rules/AI match, (4) Human Approval, (5) Visible Bundle.

---

### Task 1: Navigation Header & Design System Shell

**Files:**
- Create: `frontend/src/components/Header.tsx`
- Modify: `frontend/src/app/layout.tsx`
- Modify: `frontend/src/app/globals.css`

**Interfaces:**
- Consumes: Tailwind CSS utility classes.
- Produces: Persistent responsive top navbar with SME Company Badge ("Nusantara Retail Solutions Sdn Bhd"), Active Grant Windows badge, and Live/Mock mode indicator.

- [ ] **Step 1: Create Header component**
Create `frontend/src/components/Header.tsx` displaying:
- Product branding: "🇲🇾 SME Grant Copilot & Claim Engine"
- Problem Statement Badge: "Track #9: Low Awareness & Cumbersome Grant Application"
- Connected Profile indicator: "Nusantara Retail Solutions Sdn Bhd (SSM: 202101045892)"
- Data connection status: Green pill "SSM & Orbyte HR Linked"

- [ ] **Step 2: Update Layout**
Embed `Header` into `frontend/src/app/layout.tsx` so all pages share the top navigation.

- [ ] **Step 3: Verify build**
Run: `npm --prefix frontend run build`
Expected: Next.js compiles with status 0.

- [ ] **Step 4: Commit**
`git add frontend/src/components/Header.tsx frontend/src/app/layout.tsx`
`git commit -m "feat(frontend): add navigation header and company status shell"`

---

### Task 2: Step 1 & 5 — Grant Hub KPI Dashboard & Grant Discovery Matrix

**Files:**
- Create: `frontend/src/components/DashboardStats.tsx`
- Create: `frontend/src/components/GrantMatrixCard.tsx`
- Modify: `frontend/src/app/page.tsx`

**Interfaces:**
- Consumes: `ClaimsReadinessPackage` from `@/types/claim`.
- Produces: Executive dashboard cards showing:
  - Potential Co-Funding Claimable (e.g., "RM 5,000.00")
  - Matched Grants Count (e.g., "1 Eligible / 2 Ineligible")
  - Compliance Readiness Score ("100% Deterministic Verification")
  - Discovered Grant Cards for MDEC, SME Corp, and MATRADE.

- [ ] **Step 1: Build DashboardStats component**
Create `frontend/src/components/DashboardStats.tsx` with 4 metric cards:
1. Total Claimable Co-Funding (RM)
2. Active Claim Status (`EVALUATED` / `APPROVED` / `SUBMITTED`)
3. Connected Ingestion Sources (SSM, Orbyte HR, Invoices)
4. Audit Trail Event Count

- [ ] **Step 2: Build GrantMatrixCard component**
Create `frontend/src/components/GrantMatrixCard.tsx` displaying:
- Agency logo/badge (MDEC BSN, SME Corp, MATRADE)
- Grant name & matching cap (e.g., "50% matching up to RM5,000")
- Eligibility Status Pill (Green "Eligible" or Gray "Criteria Not Met")
- Expandable drawer or summary of rules passed.

- [ ] **Step 3: Integrate into page.tsx**
Import `MOCK_CLAIM_PACKAGE` from `@/lib/mockData` into `frontend/src/app/page.tsx` to render the initial dashboard view.

- [ ] **Step 4: Verify build**
Run: `npm --prefix frontend run build`
Expected: PASS

- [ ] **Step 5: Commit**
`git add frontend/src/components/DashboardStats.tsx frontend/src/components/GrantMatrixCard.tsx frontend/src/app/page.tsx`
`git commit -m "feat(frontend): create Grant Hub dashboard and grant matrix cards"`

---

### Task 3: Step 1 & 2 — Ingestion Simulator & Connected Data Card

**Files:**
- Create: `frontend/src/components/IngestionSimulator.tsx`
- Create: `frontend/src/components/CompanyProfileCard.tsx`

**Interfaces:**
- Consumes: `SMEProfile` and `Invoice` from `@/types/claim`.
- Produces: Trigger control panel allowing the user to switch test scenarios (e.g., Scenario A: MDEC e-Invoicing Invoice vs Scenario B: SME Corp Automation Machinery) and view live connected SSM & HR data.

- [ ] **Step 1: Create CompanyProfileCard**
Renders connected business credentials:
- SSM BizProfile: Malaysian Equity Shareholding (85%), Incorporation date, Tenure (42 mos).
- Orbyte HR: Headcount (8 FTEs), local ratio.
- Accounting: Annual sales turnover (RM 480,000).

- [ ] **Step 2: Create IngestionSimulator**
Allows 1-click trigger simulation:
- Button: "⚡ Ingest Invoice: CloudTech e-Invoicing (MDEC TSP)"
- Displays invoice number, vendor TSP accreditation status, and itemized line items.

- [ ] **Step 3: Verify build**
Run: `npm --prefix frontend run build`
Expected: PASS

- [ ] **Step 4: Commit**
`git add frontend/src/components/IngestionSimulator.tsx frontend/src/components/CompanyProfileCard.tsx`
`git commit -m "feat(frontend): add connected SSM/HR data card and trigger simulator"`

---

### Task 4: Step 4 — Human-in-the-Loop Claims Review & Narrative Editor

**Files:**
- Create: `frontend/src/components/ClaimsReviewModal.tsx`
- Create: `frontend/src/components/EligibilityChecklist.tsx`
- Create: `frontend/src/components/NarrativeEditor.tsx`

**Interfaces:**
- Consumes: `GrantEvaluation[]` and `LLMNarrative[]` from `@/types/claim`.
- Produces: Interactive review modal with:
  - Deterministic pass/fail checklist items (green ticks for equity $\ge 60\%$, turnover $\ge RM50k$, TSP verified).
  - Editable project justification & ROI text areas drafted by AI.
  - "Approve & Sign-Off Claim" button triggering state update to `APPROVED`.

- [ ] **Step 1: Build EligibilityChecklist component**
Renders each rule in `checks`:
- Displays `ruleName`, `requirement`, and `actual`.
- Icon: Green check circle if `passed: true`, Red warning triangle if `passed: false`.
- Explanatory note from the deterministic rules engine.

- [ ] **Step 2: Build NarrativeEditor component**
Displays the LLM-generated narrative:
- Project Title (editable input)
- Operational Justification (editable textarea)
- Expected Productivity ROI (editable textarea)
- AI Badge: "Drafted by Gemini Flash Grant Engine • Human Review Required"

- [ ] **Step 3: Wire up Approval Action**
Add 1-click sign-off button that transitions state from `EVALUATED` to `APPROVED` and adds a new record to the audit trail.

- [ ] **Step 4: Verify build**
Run: `npm --prefix frontend run build`
Expected: PASS

- [ ] **Step 5: Commit**
`git add frontend/src/components/ClaimsReviewModal.tsx frontend/src/components/EligibilityChecklist.tsx frontend/src/components/NarrativeEditor.tsx`
`git commit -m "feat(frontend): implement Step 4 Human-in-the-Loop review portal and narrative editor"`

---

### Task 5: Step 5 — Exportable Application Packet & Immutable Audit Trail

**Files:**
- Create: `frontend/src/components/ApplicationPacketModal.tsx`
- Create: `frontend/src/components/AuditTrailTimeline.tsx`

**Interfaces:**
- Consumes: Completed `ClaimsReadinessPackage`.
- Produces: Clean, submission-ready printable packet viewer and chronological event timeline.

- [ ] **Step 1: Build AuditTrailTimeline component**
Renders chronological timeline items:
- Timestamp, action name, and actor (e.g., "Connected Ingestion Webhook", "RulesEngine::MDEC", "Business Owner Approval").

- [ ] **Step 2: Build ApplicationPacketModal component**
Submission-ready layout with:
- Formal Malaysian Agency Submission Form Header (MDEC / SME Corp).
- Verified SSM + Orbyte HR attachment checkmarks.
- Itemized tax invoice table.
- Approved justification narrative.
- "Print / Export Application PDF" button (using `window.print()` print-friendly styling).

- [ ] **Step 3: Verify build**
Run: `npm --prefix frontend run build`
Expected: PASS

- [ ] **Step 4: Commit**
`git add frontend/src/components/ApplicationPacketModal.tsx frontend/src/components/AuditTrailTimeline.tsx`
`git commit -m "feat(frontend): create application packet exporter and audit trail viewer"`

---

### Task 6: Backend API Client & Integration Switch

**Files:**
- Create: `frontend/src/lib/api.ts`
- Modify: `frontend/src/app/page.tsx`

**Interfaces:**
- Consumes: `NEXT_PUBLIC_API_URL` environment variable.
- Produces: Asynchronous client function `evaluateClaim(request)` with fallback to `MOCK_CLAIM_PACKAGE` if backend is unreachable or offline.

- [ ] **Step 1: Write API client**
Implement `evaluateClaim` in `frontend/src/lib/api.ts` with error handling and fallback to local mock data.

- [ ] **Step 2: Add Live/Mock toggle in UI**
Add a pill button in the top right to switch between "Live Backend API" and "Mock Demonstration Mode".

- [ ] **Step 3: Verify build**
Run: `npm --prefix frontend run build`
Expected: PASS

- [ ] **Step 4: Commit**
`git add frontend/src/lib/api.ts frontend/src/app/page.tsx`
`git commit -m "feat(frontend): add live API client with seamless offline fallback toggle"`
