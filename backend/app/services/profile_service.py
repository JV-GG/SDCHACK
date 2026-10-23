"""
Organization profile rules that sit outside the grant rules themselves:
- operating tenure is derived from the SSM incorporation date (never typed in),
- field validation before a profile is saved,
- which grant rules each profile field decides, and how a draft profile changes eligibility.
All deterministic; the grant thresholds come from the rule classes in app/rules.
"""
import re
from datetime import date, datetime, timedelta, timezone
from typing import Dict, List, Optional

from app.models.schemas import (
    FieldError,
    FieldInsight,
    FieldRuleCheck,
    GrantEligibilityChange,
    ProfileImpactResponse,
    SMEProfile,
)
from app.rules import ALL_GRANT_RULES

# Profile check rule names -> the SMEProfile fields that decide them. Shared names mean the same
# criterion across agencies. tests/test_profile.py fails if a rule adds an unmapped check.
RULE_FIELDS: Dict[str, List[str]] = {
    "Malaysian Equity Ownership": ["malaysianEquityPercentage"],
    "Operational Tenure": ["incorporationDate"],
    "Operational Track Record": ["incorporationDate"],
    "Early-Stage Startup Tenure Window": ["incorporationDate"],
    "Annual Sales Turnover": ["annualTurnoverMYR"],
    "Minimum Annual Turnover": ["annualTurnoverMYR"],
    "Non-GLC / Non-MNC Status": ["isGlcOrMncOwned"],
    "SME Corp Size Classification": ["sector", "annualTurnoverMYR", "fullTimeEmployees"],
    "Active Exporter Registration": ["isActiveExporter"],
    "HRD Corp Levy Employer Threshold": ["fullTimeEmployees"],
    "Industrial Manufacturing Sector Mandate": ["sector"],
    "Manufacturing SME Classification": ["sector", "fullTimeEmployees", "annualTurnoverMYR"],
    "Early-Stage Revenue Ceiling & Independence": ["annualTurnoverMYR", "isGlcOrMncOwned"],
}

PROFILE_FIELDS = [
    "malaysianEquityPercentage",
    "incorporationDate",
    "sector",
    "isGlcOrMncOwned",
    "fullTimeEmployees",
    "annualTurnoverMYR",
    "isActiveExporter",
]

_SSM_NEW_FORMAT = re.compile(r"^\d{12}$")


def today_myt() -> date:
    return (datetime.now(timezone.utc) + timedelta(hours=8)).date()


def months_between(start: date, end: date) -> int:
    """Completed calendar months from start to end (0 if end is before start)."""
    months = (end.year - start.year) * 12 + (end.month - start.month)
    if end.day < start.day:
        months -= 1
    return max(months, 0)


def _parse_date(value: str) -> Optional[date]:
    try:
        return date.fromisoformat(value)
    except (TypeError, ValueError):
        return None


def normalize_profile(company: SMEProfile, today: Optional[date] = None) -> SMEProfile:
    """Returns a copy with tenure computed from the incorporation date and text fields trimmed."""
    inc = _parse_date(company.incorporationDate)
    updates = {
        "companyName": company.companyName.strip(),
        "registrationNumber": re.sub(r"[\s-]", "", company.registrationNumber),
    }
    if inc is not None:
        updates["tenureMonths"] = months_between(inc, today or today_myt())
    return company.model_copy(update=updates)


def validate_profile(company: SMEProfile, today: Optional[date] = None) -> List[FieldError]:
    today = today or today_myt()
    errors: List[FieldError] = []
    if not company.companyName.strip():
        errors.append(FieldError(field="companyName", message="Enter the registered company name."))
    reg = re.sub(r"[\s-]", "", company.registrationNumber)
    if not _SSM_NEW_FORMAT.match(reg):
        errors.append(FieldError(
            field="registrationNumber",
            message="Use the 12-digit SSM registration number (e.g. 201801029384).",
        ))
    inc = _parse_date(company.incorporationDate)
    if inc is None:
        errors.append(FieldError(field="incorporationDate", message="Enter a valid date (YYYY-MM-DD)."))
    elif inc > today:
        errors.append(FieldError(field="incorporationDate", message="Incorporation date cannot be in the future."))
    elif inc.year < 1900:
        errors.append(FieldError(field="incorporationDate", message="Check the year of incorporation."))
    if not 0 <= company.malaysianEquityPercentage <= 100:
        errors.append(FieldError(field="malaysianEquityPercentage", message="Equity must be between 0% and 100%."))
    if company.annualTurnoverMYR < 0:
        errors.append(FieldError(field="annualTurnoverMYR", message="Turnover cannot be negative."))
    if company.fullTimeEmployees < 0:
        errors.append(FieldError(field="fullTimeEmployees", message="Headcount cannot be negative."))
    return errors


def field_insights(company: SMEProfile) -> List[FieldInsight]:
    by_field: Dict[str, List[FieldRuleCheck]] = {f: [] for f in PROFILE_FIELDS}
    for rule in ALL_GRANT_RULES:
        for check in rule.profile_checks(company):
            for field in RULE_FIELDS.get(check.ruleName, []):
                by_field.setdefault(field, []).append(FieldRuleCheck(
                    grantId=rule.grant_id,
                    grantName=rule.grant_name,
                    agency=rule.agency,
                    ruleName=check.ruleName,
                    requirement=check.requirement,
                    passed=check.passed,
                ))
    return [FieldInsight(field=f, checks=c) for f, c in by_field.items()]


def profile_impact(current: SMEProfile, draft: SMEProfile, today: Optional[date] = None) -> ProfileImpactResponse:
    """Normalizes and validates the draft, and compares its year-round eligibility with the current profile."""
    errors = validate_profile(draft, today)
    draft_n = normalize_profile(draft, today)
    current_n = normalize_profile(current, today)
    changes: List[GrantEligibilityChange] = []
    before_count = after_count = 0
    for rule in ALL_GRANT_RULES:
        before, _ = rule.evaluate_profile(current_n)
        after, _ = rule.evaluate_profile(draft_n)
        before_count += before
        after_count += after
        if before != after:
            changes.append(GrantEligibilityChange(
                grantId=rule.grant_id,
                grantName=rule.grant_name,
                agency=rule.agency,
                maxCoFundingMYR=rule.cap_myr,
                before=before,
                after=after,
            ))
    return ProfileImpactResponse(
        company=draft_n,
        fieldErrors=errors,
        fieldInsights=field_insights(draft_n),
        changes=changes,
        eligibleBefore=before_count,
        eligibleAfter=after_count,
    )
