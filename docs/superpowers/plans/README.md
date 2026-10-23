# 👥 2-Member Parallel Execution Plan

> **SDCHACK 2026 — Track #9: Autonomous SME GrantFlow & Claim Engine**  
> *Two fully decoupled tracks designed for zero merge conflicts and simultaneous development.*

---

## 📌 Track Overview & Ownership

| Track | Owner | Directory Boundary | Core Deliverables | Superpower Plan Document |
| :--- | :--- | :--- | :--- | :--- |
| **Track 1: Frontend & Human-in-the-Loop UX** | **Member 1** | `frontend/` | • Grant Hub KPI Dashboard<br>• Connected SSM / HR Profile Card<br>• Step 4 Claims Review & Checklist Modal<br>• Editable AI Narrative Preview<br>• Step 5 Submission Bundle & Audit Trail Exporter | [Member 1 Plan](file:///Users/wenfei/Hackathon/SDC Hackathon 2026/SDCHACK/docs/superpowers/plans/2026-10-22-member-1-frontend-ux.md) |
| **Track 2: Backend, Rules Engine & AI Agent** | **Member 2** | `backend/` | • Pydantic Contract Validation<br>• Deterministic Rules for MDEC, SME Corp, MATRADE<br>• Lightweight Gemini Flash Narrative Drafter<br>• REST API Orchestration (`/evaluate`, `/approve`)<br>• Replit / Public Cloud Deployment | [Member 2 Plan](file:///Users/wenfei/Hackathon/SDC Hackathon 2026/SDCHACK/docs/superpowers/plans/2026-10-22-member-2-backend-ai.md) |

---

## 🤝 The Single Source of Truth: Data Contract

Both tracks develop against the pre-agreed data contract:
- **TypeScript Types**: [`contract/types.ts`](file:///Users/wenfei/Hackathon/SDC Hackathon 2026/SDCHACK/contract/types.ts)
- **Sample JSON Fixture**: [`contract/mock_claim_package.json`](file:///Users/wenfei/Hackathon/SDC Hackathon 2026/SDCHACK/contract/mock_claim_package.json)

Neither member needs to wait for the other:
- Member 1 builds the entire UI using `frontend/src/lib/mockData.ts`.
- Member 2 tests the backend against `contract/mock_claim_package.json`.

---

## ⚡ Quick Start for Development

Run both in parallel with a single command from root:
```bash
npm run dev
```

- **Frontend**: `http://localhost:3000`
- **Backend Swagger Docs**: `http://localhost:8000/api/v1/docs`
