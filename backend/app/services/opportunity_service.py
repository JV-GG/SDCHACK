"""
Year-round grant opportunity scanning.

Runs only the profile stage of every deterministic rule (no invoice needed) and combines it with
each scheme's application window, so an SME learns which programmes it can apply for before it
spends anything. Triggered by profile registration/update, grant crawls, and the scheduled scan.
"""
from datetime import date, datetime, timedelta, timezone
from typing import List, Optional, Tuple

from app.models.schemas import (
    ApplicationMode,
    GrantSchemeMetadata,
    OpportunityScanResponse,
    ProfileGrantMatch,
    SMEProfile,
    WindowStatus,
)
from app.rules import ALL_GRANT_RULES
from app.services.db_service import list_grant_schemes

CLOSING_SOON_DAYS = 14

_STATUS_ORDER = {
    WindowStatus.CLOSING_SOON: 0,
    WindowStatus.OPEN: 1,
    WindowStatus.UPCOMING: 2,
    WindowStatus.CLOSED: 3,
}


def _today_myt() -> date:
    # Agency windows are published in Malaysia time (UTC+8).
    return (datetime.now(timezone.utc) + timedelta(hours=8)).date()


def window_status(
    scheme: Optional[GrantSchemeMetadata], today: date
) -> Tuple[WindowStatus, Optional[int], Optional[int]]:
    """Returns (status, days until close, days until open) for a scheme on a given day."""
    if scheme is None or not scheme.isActive:
        return WindowStatus.CLOSED, None, None
    if scheme.applicationMode == ApplicationMode.ROLLING:
        return WindowStatus.OPEN, None, None

    opens = date.fromisoformat(scheme.opensAt) if scheme.opensAt else None
    closes = date.fromisoformat(scheme.closesAt) if scheme.closesAt else None

    if opens and today < opens:
        return WindowStatus.UPCOMING, None, (opens - today).days
    if closes and today > closes:
        return WindowStatus.CLOSED, None, None
    days_left = (closes - today).days if closes else None
    if days_left is not None and days_left <= CLOSING_SOON_DAYS:
        return WindowStatus.CLOSING_SOON, days_left, None
    return WindowStatus.OPEN, days_left, None


def _next_step(eligible: bool, status: WindowStatus, rule_next_step: str, checks, days_open) -> str:
    if not eligible:
        failed = [c for c in checks if not c.passed]
        first = next((c.gapAdvice for c in failed if c.gapAdvice), None)
        names = ", ".join(c.ruleName for c in failed)
        return f"Not yet eligible ({names}). {first}" if first else f"Not yet eligible ({names})."
    if status == WindowStatus.CLOSED:
        return "Your profile qualifies, but the application window is closed. You will be alerted when it reopens."
    if status == WindowStatus.UPCOMING:
        return f"Opens in {days_open} day{'s' if days_open != 1 else ''}. Prepare now: {rule_next_step}"
    return rule_next_step


def scan_profile(
    org_id: str,
    company: SMEProfile,
    trigger_source: str,
    today: Optional[date] = None,
    schemes: Optional[List[GrantSchemeMetadata]] = None,
) -> OpportunityScanResponse:
    today = today or _today_myt()
    schemes_by_id = {s.grantId: s for s in (schemes if schemes is not None else list_grant_schemes())}

    matches: List[ProfileGrantMatch] = []
    for rule in ALL_GRANT_RULES:
        scheme = schemes_by_id.get(rule.grant_id)
        eligible, checks = rule.evaluate_profile(company)
        status, days_close, days_open = window_status(scheme, today)
        matches.append(
            ProfileGrantMatch(
                grantId=rule.grant_id,
                grantName=rule.grant_name,
                agency=rule.agency,
                matchingPercentage=rule.matching_percentage,
                maxCoFundingMYR=rule.cap_myr,
                isProfileEligible=eligible,
                profileChecks=checks,
                eligibleCategories=list(rule.eligible_categories),
                applicationMode=scheme.applicationMode if scheme else ApplicationMode.ROLLING,
                windowStatus=status,
                opensAt=scheme.opensAt if scheme else None,
                closesAt=scheme.closesAt if scheme else None,
                daysUntilClose=days_close,
                daysUntilOpen=days_open,
                requiresPreApproval=scheme.requiresPreApproval if scheme else False,
                nextStep=_next_step(eligible, status, rule.next_step, checks, days_open),
                sourceUrl=scheme.sourceUrl if scheme else "",
                requiredDocuments=list(rule.required_documents),
            )
        )

    # Eligible first, then most urgent window, then largest ceiling.
    matches.sort(
        key=lambda m: (not m.isProfileEligible, _STATUS_ORDER[m.windowStatus], -m.maxCoFundingMYR)
    )

    accepting = {WindowStatus.OPEN, WindowStatus.CLOSING_SOON}
    eligible_open = [m for m in matches if m.isProfileEligible and m.windowStatus in accepting]
    return OpportunityScanResponse(
        orgId=org_id,
        scannedAt=datetime.now(timezone.utc).isoformat(),
        triggerSource=trigger_source,
        matches=matches,
        eligibleCount=sum(1 for m in matches if m.isProfileEligible),
        openNowCount=len(eligible_open),
        potentialCoFundingMYR=sum(m.maxCoFundingMYR for m in eligible_open),
    )


def describe_scan(company: SMEProfile, scan: OpportunityScanResponse) -> str:
    closing = [m for m in scan.matches if m.isProfileEligible and m.windowStatus == WindowStatus.CLOSING_SOON]
    upcoming = [m for m in scan.matches if m.isProfileEligible and m.windowStatus == WindowStatus.UPCOMING]
    parts = [
        f"{company.companyName} pre-qualifies for {scan.eligibleCount} of {len(scan.matches)} schemes on profile alone; "
        f"{scan.openNowCount} accepting applications now (up to RM {scan.potentialCoFundingMYR:,.0f} in scheme ceilings)."
    ]
    if closing:
        parts.append(
            "Closing soon: "
            + ", ".join(f"{m.grantName} ({m.daysUntilClose}d)" for m in closing)
            + "."
        )
    if upcoming:
        parts.append(
            "Opening soon: " + ", ".join(f"{m.grantName} ({m.daysUntilOpen}d)" for m in upcoming) + "."
        )
    return " ".join(parts)
