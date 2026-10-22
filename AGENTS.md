# Agent Operating Guidelines: SDCHACK 2026 (Problem Statement #9)

## 🚨 Critical Non-Negotiable Rules

1. **NEVER AUTO-PUSH TO GITHUB**:
   - Do NOT run `git push` under any circumstances. The user will manually review and push commits themselves.

2. **STRICT DIRECTORY BOUNDARY**:
   - Member 1 (Frontend): Work strictly inside `/frontend`.
   - Member 2 (Backend): Work strictly inside `/backend`.
   - Shared Schema: Changes must be coordinated in `/contract/types.ts` and mirrored in `backend/app/models/schemas.py`.

3. **DETERMINISTIC EVALUATION FIRST (ZERO HALLUCINATION)**:
   - Quantitative grant rules (Malaysian equity %, SME Corp sector caps, tenure, turnover, TSP whitelisting) must ALWAYS be evaluated by deterministic Python functions in `backend/app/rules/`.
   - The LLM is ONLY used for unstructured invoice parsing and project justification narrative drafting.

4. **HUMAN-IN-THE-LOOP SUPREMACY**:
   - The system must never claim or submit automatically without explicit human sign-off in the Step 4 review screen.
   - LLM-generated narratives must be presented as editable drafts.

5. **ACTIVATE SKILL FOR GRANT DOMAIN TASKS**:
   - When modifying rules, invoices, approval workflows, or packet generation, refer to `.agents/skills/sme-grant-copilot/SKILL.md`.
