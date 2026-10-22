from app.rules.base import BaseGrantRule
from app.models.schemas import SMEProfile, Invoice, GrantEvaluation, RuleCheckResult, InvoiceItemCategory

class CradleCipSparkRule(BaseGrantRule):
    grant_id = "CRADLE_CIP_SPARK"
    grant_name = "Cradle CIP Spark Tech Commercialisation Grant"
    agency = "Cradle Fund"
    matching_percentage = 80
    cap_myr = 150000.0

    def evaluate(self, company: SMEProfile, invoice: Invoice) -> GrantEvaluation:
        checks = []

        # 1. Malaysian Equity >= 51%
        equity_pass = company.malaysianEquityPercentage >= 51.0
        checks.append(RuleCheckResult(
            ruleName="Malaysian Equity Ownership",
            passed=equity_pass,
            requirement="≥ 51% Malaysian shareholding",
            actual=f"{company.malaysianEquityPercentage:.1f}% Malaysian equity",
            reason="Meets Cradle Fund Malaysian founder equity requirement." if equity_pass else "Below 51% Malaysian shareholding.",
            gapAdvice=None if equity_pass else "Cradle CIP Spark requires minimum 51% Malaysian shareholding."
        ))

        # 2. Early-Stage Startup Tenure Window (6 to 36 months)
        tenure_pass = 6 <= company.tenureMonths <= 36
        checks.append(RuleCheckResult(
            ruleName="Early-Stage Startup Tenure Window",
            passed=tenure_pass,
            requirement="Between 6 and 36 months since SSM incorporation",
            actual=f"{company.tenureMonths} months in business",
            reason="Qualifies within early-stage technology startup window." if tenure_pass else "Company tenure outside the 6–36 month early-stage startup window.",
            gapAdvice=None if tenure_pass else (
                "Cradle CIP Spark is strictly for early-stage startups incorporated within the last 36 months. "
                "Established SMEs (> 36 months) should apply for MDEC MSME Digital Grant or SME Corp SAG."
            )
        ))

        # 3. Revenue Ceiling (<= RM 5,000,000) & Independent Status
        rev_pass = company.annualTurnoverMYR <= 5000000.0 and not company.isGlcOrMncOwned
        checks.append(RuleCheckResult(
            ruleName="Early-Stage Revenue Ceiling & Independence",
            passed=rev_pass,
            requirement="Annual turnover ≤ RM 5.0M and independent private startup",
            actual=f"RM {company.annualTurnoverMYR:,.2f} ({'Independent' if not company.isGlcOrMncOwned else 'GLC/MNC Linked'})",
            reason="Within Cradle early-stage revenue ceiling." if rev_pass else "Exceeds RM 5.0M revenue cap or has GLC/MNC ownership.",
            gapAdvice=None if rev_pass else "Applicant must be an independent private SME with cumulative annual revenue below RM 5,000,000."
        ))

        # 4. Cloud / Software Commercialisation Expenditure Scope (DIGITAL_ERP)
        erp_total = sum(
            item.totalPriceMYR for item in invoice.items
            if item.category == InvoiceItemCategory.DIGITAL_ERP
        )
        scope_pass = erp_total > 0
        checks.append(RuleCheckResult(
            ruleName="Cloud Software / Tech Commercialisation Scope",
            passed=scope_pass,
            requirement="Invoice must include Cloud ERP, SaaS architecture, or software commercialisation items",
            actual=f"RM {erp_total:,.2f} eligible cloud/software items",
            reason="Eligible software and cloud architecture scope identified." if scope_pass else "No qualifying software/cloud architecture items in invoice.",
            gapAdvice=None if scope_pass else "Include cloud infrastructure, SaaS development, or Digital ERP deployment costs to claim under Cradle CIP Spark."
        ))

        all_passed = all(c.passed for c in checks)
        co_funding = min(erp_total * (self.matching_percentage / 100.0), self.cap_myr) if all_passed else 0.0

        required_docs = [
            "SSM Incorporation Certificate & Superform (Section 14)",
            "Technology Commercialisation & IP Pitch Deck",
            "18-Month Milestone & Cashflow Projection",
            "Cloud / Software Vendor Official Quotation & Invoice"
        ]

        return GrantEvaluation(
            grantId=self.grant_id,
            grantName=self.grant_name,
            agency=self.agency,
            isEligible=all_passed,
            maxCoFundingMYR=co_funding,
            matchingPercentage=self.matching_percentage,
            checks=checks,
            requiredDocuments=required_docs
        )
