from abc import ABC, abstractmethod
from typing import List, Tuple
from app.models.schemas import (
    SMEProfile,
    Invoice,
    GrantEvaluation,
    InvoiceItemCategory,
    RuleCheckResult,
)


class BaseGrantRule(ABC):
    """
    Two-stage deterministic grant rule.

    Stage 1 `profile_checks` uses only the SME's company data (SSM, HR, turnover), so it can run
    year-round with no invoice, e.g. when a profile changes or a grant window opens.
    Stage 2 `claim_checks` validates a specific invoice/quotation (scope, vendor, CapEx) and
    returns the RM amount eligible for co-funding.
    """

    grant_id: str
    grant_name: str
    agency: str
    matching_percentage: int
    cap_myr: float
    # Spending categories this scheme co-funds (shown to SMEs before they spend).
    eligible_categories: List[InvoiceItemCategory] = []
    required_documents: List[str] = []
    # Action to take once the profile pre-qualifies.
    next_step: str = ""

    @abstractmethod
    def profile_checks(self, company: SMEProfile) -> List[RuleCheckResult]:
        """Company-level criteria that need no invoice (equity, tenure, size, sector, status)."""

    @abstractmethod
    def claim_checks(
        self, company: SMEProfile, invoice: Invoice
    ) -> Tuple[List[RuleCheckResult], float]:
        """Invoice-level criteria. Returns (checks, eligible expenditure in RM)."""

    def co_funding(self, eligible_total: float) -> float:
        return min(eligible_total * (self.matching_percentage / 100.0), self.cap_myr)

    def evaluate_profile(self, company: SMEProfile) -> Tuple[bool, List[RuleCheckResult]]:
        checks = self.profile_checks(company)
        return all(c.passed for c in checks), checks

    def evaluate(self, company: SMEProfile, invoice: Invoice) -> GrantEvaluation:
        """Full claim evaluation: profile checks followed by invoice checks."""
        checks = self.profile_checks(company)
        invoice_checks, eligible_total = self.claim_checks(company, invoice)
        checks.extend(invoice_checks)

        all_passed = all(c.passed for c in checks)
        return GrantEvaluation(
            grantId=self.grant_id,
            grantName=self.grant_name,
            agency=self.agency,
            isEligible=all_passed,
            maxCoFundingMYR=self.co_funding(eligible_total) if all_passed else 0.0,
            matchingPercentage=self.matching_percentage,
            checks=checks,
            requiredDocuments=list(self.required_documents),
        )


def category_total(invoice: Invoice, categories: List[InvoiceItemCategory]) -> float:
    return sum(item.totalPriceMYR for item in invoice.items if item.category in categories)
