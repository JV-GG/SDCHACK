from app.rules.base import BaseGrantRule
from app.models.schemas import SMEProfile, Invoice, GrantEvaluation, RuleCheckResult, SectorType, InvoiceItemCategory

class MidaDisfRule(BaseGrantRule):
    grant_id = "MIDA_DISF"
    grant_name = "MIDA Domestic Investment Strategic Fund (DISF) Automation"
    agency = "MIDA"
    matching_percentage = 60
    cap_myr = 500000.0

    def evaluate(self, company: SMEProfile, invoice: Invoice) -> GrantEvaluation:
        checks = []

        # 1. Malaysian Equity >= 60%
        equity_pass = company.malaysianEquityPercentage >= 60.0
        checks.append(RuleCheckResult(
            ruleName="Malaysian Equity Ownership",
            passed=equity_pass,
            requirement="≥ 60% Malaysian equity ownership",
            actual=f"{company.malaysianEquityPercentage:.1f}% Malaysian equity",
            reason="Meets MIDA DISF statutory 60% local equity threshold." if equity_pass else "Below 60% Malaysian ownership.",
            gapAdvice=None if equity_pass else "MIDA DISF strictly mandates at least 60% Malaysian shareholding in SSM BizProfile."
        ))

        # 2. Industrial Sector Mandate (Manufacturing)
        sector_pass = company.sector == SectorType.MANUFACTURING
        checks.append(RuleCheckResult(
            ruleName="Industrial Manufacturing Sector Mandate",
            passed=sector_pass,
            requirement="Registered in Manufacturing / Industrial Engineering sector",
            actual=f"{company.sector.value} sector",
            reason="Company operates in qualifying manufacturing sector." if sector_pass else "Company is registered in Services rather than Manufacturing.",
            gapAdvice=None if sector_pass else "MIDA DISF targets manufacturing and industrial engineering enterprises. Services SMEs should apply for MDEC or SME Corp grants."
        ))

        # 3. Operational Tenure >= 24 months
        tenure_pass = company.tenureMonths >= 24
        checks.append(RuleCheckResult(
            ruleName="Operational Track Record",
            passed=tenure_pass,
            requirement="≥ 24 months manufacturing track record",
            actual=f"{company.tenureMonths} months in business",
            reason="Meets 2-year industrial track record requirement." if tenure_pass else "Less than 24 months operational tenure.",
            gapAdvice=None if tenure_pass else "MIDA requires at least 24 months of operational track record and 2 years of audited financial statements."
        ))

        # 4. Minimum Turnover >= RM 500,000 AND >= 100,000 Automation Expenditure
        automation_total = sum(
            item.totalPriceMYR for item in invoice.items
            if item.category == InvoiceItemCategory.AUTOMATION_HARDWARE
        )
        cap_pass = company.annualTurnoverMYR >= 500000.0 and automation_total >= 250000.0
        checks.append(RuleCheckResult(
            ruleName="High-Value Capital Machinery & Turnover Threshold",
            passed=cap_pass,
            requirement="Annual turnover ≥ RM 500k and Automation CapEx ≥ RM 250,000",
            actual=f"Turnover RM {company.annualTurnoverMYR:,.0f} · Automation CapEx RM {automation_total:,.2f}",
            reason="Qualifies for MIDA strategic high-value capital automation co-funding." if cap_pass else "Does not meet strategic CapEx (≥ RM 250k) or turnover (≥ RM 500k) threshold.",
            gapAdvice=None if cap_pass else "MIDA DISF covers major factory automation upgrades (≥ RM 250,000). For smaller machinery (< RM 250k), apply under SME Corp Smart Automation Grant (SAG)."
        ))

        all_passed = all(c.passed for c in checks)
        co_funding = min(automation_total * (self.matching_percentage / 100.0), self.cap_myr) if all_passed else 0.0

        required_docs = [
            "MIDA Manufacturing License / ICA10 Exemption Letter",
            "SSM Corporate Profile (Form 9, 24 & 49)",
            "Latest 3-Year Audited Financial Statements",
            "Machinery Technical Blueprint & ROI Assessment"
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
