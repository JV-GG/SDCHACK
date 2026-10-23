"""Profile editing: computed tenure, validation, grant impact preview, password change."""
from datetime import date

from fastapi.testclient import TestClient

from app.main import app
from app.models.schemas import SMEProfile
from app.rules import ALL_GRANT_RULES
from app.services.db_service import DEFAULT_ORGS
from app.services.profile_service import (
    RULE_FIELDS,
    months_between,
    normalize_profile,
    profile_impact,
    validate_profile,
)

client = TestClient(app)
SEED = next(o for o in DEFAULT_ORGS if o["id"] == "org-nusantara")
TODAY = date(2026, 10, 23)


def _profile(**overrides) -> SMEProfile:
    return SMEProfile.model_validate({**SEED["company"], **overrides})


def _register(email: str, password: str = "initial-pass-1") -> str:
    res = client.post("/api/v1/auth/register", json={"email": email, "password": password, "company": SEED["company"]})
    assert res.status_code == 200, res.text
    return res.json()["id"]


def test_months_between_counts_completed_months():
    assert months_between(date(2021, 4, 15), date(2026, 10, 23)) == 66
    assert months_between(date(2026, 4, 24), date(2026, 10, 23)) == 5  # day not reached yet
    assert months_between(date(2026, 4, 23), date(2026, 10, 23)) == 6
    assert months_between(date(2027, 1, 1), date(2026, 10, 23)) == 0


def test_normalize_derives_tenure_and_cleans_registration():
    p = normalize_profile(_profile(tenureMonths=999, registrationNumber="2021-0104 5892"), TODAY)
    assert p.tenureMonths == 66
    assert p.registrationNumber == "202101045892"


def test_validation_messages():
    errs = validate_profile(
        _profile(companyName=" ", registrationNumber="123", incorporationDate="2030-01-01",
                 malaysianEquityPercentage=120, fullTimeEmployees=-1, annualTurnoverMYR=-5),
        TODAY,
    )
    assert {e.field for e in errs} == {
        "companyName", "registrationNumber", "incorporationDate",
        "malaysianEquityPercentage", "fullTimeEmployees", "annualTurnoverMYR",
    }
    assert validate_profile(_profile(), TODAY) == []


def test_every_profile_check_is_mapped_to_a_field():
    for rule in ALL_GRANT_RULES:
        for check in rule.profile_checks(_profile()):
            assert check.ruleName in RULE_FIELDS, f"{rule.grant_id}: '{check.ruleName}' has no field mapping"


def test_impact_reports_gained_and_lost_grants():
    current = _profile()  # 8 FTEs, not an exporter
    draft = _profile(fullTimeEmployees=12, isActiveExporter=True, malaysianEquityPercentage=55)
    impact = profile_impact(current, draft, TODAY)
    gained = {c.grantId for c in impact.changes if c.after}
    lost = {c.grantId for c in impact.changes if not c.after}
    assert "HRD_CORP_SBL" in gained  # 12 FTEs >= 10
    assert "MDEC_MSME_DIGITAL" in lost  # 55% < 60%
    assert "MATRADE_MDG" not in gained  # exporter, but 55% < 60%
    equity = next(i for i in impact.fieldInsights if i.field == "malaysianEquityPercentage")
    assert {c.grantId for c in equity.checks} == {r.grant_id for r in ALL_GRANT_RULES}
    assert any(c.passed for c in equity.checks) and any(not c.passed for c in equity.checks)


def test_preview_endpoint_does_not_save():
    org_id = _register("preview-test@example.my")
    res = client.post(f"/api/v1/organizations/{org_id}/profile/preview", json=_profile(fullTimeEmployees=50).model_dump())
    assert res.status_code == 200
    assert any(c["grantId"] == "HRD_CORP_SBL" and c["after"] for c in res.json()["changes"])
    assert client.get(f"/api/v1/organizations/{org_id}").json()["company"]["fullTimeEmployees"] == 8


def test_put_profile_validates_computes_tenure_and_audits_effect():
    org_id = _register("put-test@example.my")
    bad = client.put(f"/api/v1/organizations/{org_id}/profile", json=_profile(malaysianEquityPercentage=140).model_dump())
    assert bad.status_code == 422
    assert bad.json()["detail"]["fieldErrors"][0]["field"] == "malaysianEquityPercentage"

    res = client.put(
        f"/api/v1/organizations/{org_id}/profile",
        json=_profile(fullTimeEmployees=15, tenureMonths=1).model_dump(),
    )
    assert res.status_code == 200
    company = res.json()["company"]
    assert company["fullTimeEmployees"] == 15
    assert company["tenureMonths"] > 1  # typed value ignored; derived from 2021-04-15

    evt = next(
        e for e in client.get(f"/api/v1/organizations/{org_id}/audit-events").json()["events"]
        if e["eventType"] == "PROFILE_UPDATED"
    )
    assert "Full-time employees: 8 → 15" in evt["description"]
    assert "Now qualifies: HRD Corp SBL-Khas" in evt["description"]


def test_document_submission_cannot_overwrite_profile():
    org_id = _register("stale-test@example.my")
    client.put(f"/api/v1/organizations/{org_id}/profile", json=_profile(fullTimeEmployees=20).model_dump())
    stale = _profile(fullTimeEmployees=1).model_dump()
    pkg = client.post(
        f"/api/v1/triggers/submit-invoice?org_id={org_id}",
        json={"company": stale, "invoice": SEED["defaultInvoice"]},
    ).json()
    assert pkg["company"]["fullTimeEmployees"] == 20
    assert client.get(f"/api/v1/organizations/{org_id}").json()["company"]["fullTimeEmployees"] == 20


def test_password_change_hashes_and_enforces_new_password():
    org_id = _register("pw-test@example.my", "initial-pass-1")
    email = "pw-test@example.my"
    url = f"/api/v1/organizations/{org_id}/password"

    assert client.post(url, json={"currentPassword": "wrong-pass", "newPassword": "brand-new-pass"}).status_code == 403
    assert client.post(url, json={"currentPassword": "initial-pass-1", "newPassword": "short"}).status_code == 422
    assert client.post(url, json={"currentPassword": "initial-pass-1", "newPassword": "brand-new-pass"}).status_code == 204

    login = lambda pw: client.post("/api/v1/auth/login", json={"email": email, "password": pw}).status_code  # noqa: E731
    assert login("brand-new-pass") == 200
    assert login("initial-pass-1") == 401
    assert login("demo123") == 401  # demo shortcut does not apply to hashed accounts
    assert login("") == 401

    types = [e["eventType"] for e in client.get(f"/api/v1/organizations/{org_id}/audit-events").json()["events"]]
    assert "PASSWORD_CHANGED" in types and "PASSWORD_CHANGE_FAILED" in types


def test_seeded_demo_accounts_still_sign_in():
    assert client.post("/api/v1/auth/login", json={"email": "finance@nusantara.com.my", "password": "demo123"}).status_code == 200
