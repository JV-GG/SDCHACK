"""Server-side, hash-chained audit logging."""
import sqlite3

from fastapi.testclient import TestClient

from app.main import app
from app.services.audit_service import verify_chain, _rows_for_org
from app.services.db_service import DEFAULT_ORGS, LOCAL_DB_PATH

client = TestClient(app)
ORG = "org-precision-mfg"
EMAIL = "ops@precision-mfg.com.my"
SEED = next(o for o in DEFAULT_ORGS if o["id"] == ORG)
IP = {"X-Forwarded-For": "203.0.113.7, 10.0.0.1", "User-Agent": "pytest-audit"}


def _events(org_id=ORG):
    res = client.get(f"/api/v1/organizations/{org_id}/audit-events")
    assert res.status_code == 200
    return res.json()


def _latest(event_type, org_id=ORG):
    return next(e for e in _events(org_id)["events"] if e["eventType"] == event_type)


def test_login_records_account_email_ip_and_user_agent():
    res = client.post("/api/v1/auth/login", json={"email": EMAIL, "password": "demo123"}, headers=IP)
    assert res.status_code == 200
    evt = _latest("LOGIN")
    assert evt["actorEmail"] == EMAIL
    assert evt["ipAddress"] == "203.0.113.7"  # first hop of X-Forwarded-For
    assert evt["userAgent"] == "pytest-audit"
    assert evt["category"] == "AUTH"


def test_failed_login_is_logged_against_the_account():
    # Any password is accepted for the seeded demo accounts, so use a registered account with a real password.
    reg = client.post(
        "/api/v1/auth/register",
        json={"email": "audit-test@example.my", "password": "s3cret-pass", "company": SEED["company"]},
    )
    org_id = reg.json()["id"]
    assert _latest("ORG_REGISTERED", org_id)["actorEmail"] == "audit-test@example.my"

    bad = client.post("/api/v1/auth/login", json={"email": "audit-test@example.my", "password": "wrong"}, headers=IP)
    assert bad.status_code == 401
    evt = _latest("LOGIN_FAILED", org_id)
    assert evt["ipAddress"] == "203.0.113.7"


def test_session_resume_and_switch_are_logged():
    for reason, expected in (("RESUME", "SESSION_RESUMED"), ("SWITCH", "ORG_SWITCHED")):
        res = client.post("/api/v1/auth/session", json={"orgId": ORG, "reason": reason}, headers=IP)
        assert res.status_code == 200
        assert res.json()["eventType"] == expected


def test_quotation_submission_credits_user_not_accounting_hook():
    res = client.post(
        f"/api/v1/triggers/submit-invoice?org_id={ORG}",
        json={
            "company": SEED["company"],
            "invoice": SEED["defaultInvoice"],
            "documentKind": "QUOTATION",
            "documentSource": "PRESET",
            "targetGrantId": "SME_CORP_SAG",
        },
        headers=IP,
    )
    assert res.status_code == 200
    pkg = res.json()
    first = pkg["auditTrail"][0]
    assert first["action"].startswith("Quotation #INV-AUTO-7740 submitted for SME_CORP_SAG")
    assert "sample preset selected" in first["action"]
    assert EMAIL in first["performedBy"] and "203.0.113.7" in first["performedBy"]
    assert "Orbyte" not in first["performedBy"]
    drafted = next(e for e in pkg["auditTrail"] if e["eventType"] == "NARRATIVES_DRAFTED")
    assert drafted["performedBy"] != "DeepSeek-V3 Grant Copilot"  # default path never calls the AI

    doc = _latest("DOCUMENT_SUBMITTED")
    assert doc["claimId"] == pkg["claimId"] and doc["category"] == "DOCUMENT"
    assert "Target Smart Automation Grant (SAG): passed" in _latest("CLAIM_EVALUATED")["description"]


def test_approve_and_submit_are_server_authoritative():
    pkg = client.post(
        f"/api/v1/triggers/submit-invoice?org_id={ORG}",
        json={"company": SEED["company"], "invoice": SEED["defaultInvoice"]},
        headers=IP,
    ).json()
    claim_id = pkg["claimId"]

    # Submitting before sign-off is rejected.
    assert client.post(f"/api/v1/claims/{claim_id}/submit", json={}).status_code == 409

    # A forged trail and status from the browser must be ignored; only narratives are accepted.
    forged = dict(pkg)
    forged["auditTrail"] = [{"action": "forged", "timestamp": "2020-01-01T00:00:00Z", "performedBy": "attacker"}]
    forged["totalClaimableAmountMYR"] = 9_999_999
    forged["narratives"] = [dict(pkg["narratives"][0], projectTitle="Edited by reviewer")] + pkg["narratives"][1:]
    approved = client.post(f"/api/v1/claims/{claim_id}/approve?org_id={ORG}", json=forged, headers=IP).json()

    assert approved["status"] == "APPROVED"
    assert approved["totalClaimableAmountMYR"] == pkg["totalClaimableAmountMYR"]
    assert all(e["action"] != "forged" for e in approved["auditTrail"])
    assert approved["narratives"][0]["projectTitle"] == "Edited by reviewer"
    signoffs = [e for e in approved["auditTrail"] if e["eventType"] == "CLAIM_APPROVED"]
    assert len(signoffs) == 1 and EMAIL in signoffs[0]["performedBy"]
    assert any(e["eventType"] == "NARRATIVE_EDITED" for e in approved["auditTrail"])

    # Approving again does not add a second sign-off.
    again = client.post(f"/api/v1/claims/{claim_id}/approve?org_id={ORG}", json=approved).json()
    assert sum(e["eventType"] == "CLAIM_APPROVED" for e in again["auditTrail"]) == 1

    sub = client.post(f"/api/v1/claims/{claim_id}/submit", json={"verificationHash": "ab" * 32}, headers=IP)
    assert sub.status_code == 200
    body = sub.json()
    assert body["claim"]["status"] == "SUBMITTED"
    eligible = [e for e in pkg["evaluations"] if e["isEligible"]]
    assert len(body["records"]) == len(eligible)
    assert {r["claimableAmountMYR"] for r in body["records"]} == {e["maxCoFundingMYR"] for e in eligible}

    latest = client.get(f"/api/v1/organizations/{ORG}/claims/latest").json()
    assert latest["claimId"] == claim_id and latest["status"] == "SUBMITTED"
    assert "ab" * 32 in latest["auditTrail"][-1]["action"]

    # Re-submitting creates no duplicate records.
    assert client.post(f"/api/v1/claims/{claim_id}/submit", json={}).json()["records"] == []


def test_hash_chain_detects_tampering():
    client.post("/api/v1/auth/session", json={"orgId": ORG, "reason": "RESUME"})
    assert _events()["chainValid"] is True

    rows = _rows_for_org(ORG)
    assert verify_chain(rows) == (True, None)
    tampered = [dict(r) for r in rows]
    tampered[-1]["ip_address"] = "1.2.3.4"
    valid, broken = verify_chain(tampered)
    assert valid is False and broken == rows[-1]["id"]


def test_tampering_in_database_is_reported_by_endpoint():
    org_id = client.post(
        "/api/v1/auth/register",
        json={"email": "tamper-test@example.my", "password": "x", "company": SEED["company"]},
    ).json()["id"]
    client.post("/api/v1/auth/session", json={"orgId": org_id, "reason": "RESUME"})
    assert _events(org_id)["chainValid"] is True
    with sqlite3.connect(LOCAL_DB_PATH) as conn:
        conn.execute("UPDATE audit_events SET description = 'rewritten' WHERE org_id = ?", (org_id,))
    assert _events(org_id)["chainValid"] is False


def test_repeated_reloads_and_crawls_are_throttled():
    org_id = client.post(
        "/api/v1/auth/register",
        json={"email": "throttle-test@example.my", "password": "x", "company": SEED["company"]},
    ).json()["id"]
    for _ in range(3):
        client.post("/api/v1/auth/session", json={"orgId": org_id, "reason": "RESUME"}, headers=IP)
        client.post(f"/api/v1/triggers/crawl-grants?org_id={org_id}")
    types = [e["eventType"] for e in _events(org_id)["events"]]
    assert types.count("SESSION_RESUMED") == 1
    assert types.count("GRANT_CRAWL") == 1
    # Switching is a deliberate action and is never throttled.
    for _ in range(2):
        client.post("/api/v1/auth/session", json={"orgId": org_id, "reason": "SWITCH"}, headers=IP)
    assert [e["eventType"] for e in _events(org_id)["events"]].count("ORG_SWITCHED") == 2
