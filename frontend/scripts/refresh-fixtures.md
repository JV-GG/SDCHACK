# Refreshing the frontend mock fixtures

`frontend/src/lib/backendFixtures.json` is generated from the backend, so mock mode matches live mode.
Regenerate it when the backend's rules or `backend/data/scenarios.json` change.

Run with the backend's Python dependencies installed. Rules and amounts are deterministic. The
narratives come from whichever LLM tier the backend reaches: with keys in `backend/.env` that is
DeepSeek (the scenario data is sent to it); with no keys it is the offline template engine. To force
the offline engine, move `backend/.env` aside while you run this.

```bash
cd backend
python - <<'EOF'
import json
from fastapi.testclient import TestClient
from app.main import app

c = TestClient(app)
out = []
for s in c.get("/api/v1/scenarios").json():
    r = c.post("/api/v1/claims/evaluate", json={"company": s["company"], "invoice": s["invoice"]})
    r.raise_for_status()
    out.append({"scenario": s, "claim": r.json()})
json.dump(out, open("../frontend/src/lib/backendFixtures.json", "w"), indent=2, ensure_ascii=False)
print(f"wrote {len(out)} scenarios")
EOF
```

Then run `npm --prefix frontend run build`. `mockData.ts` asserts that every fixture's totals add up.
