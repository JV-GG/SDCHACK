from typing import List, Tuple
from app.rules.base import BaseGrantRule, category_total
from app.models.schemas import SMEProfile, Invoice, RuleCheckResult, SectorType, InvoiceItemCategory


class MidaDisfRule(BaseGrantRule):
    grant_id = "MIDA_DISF"
    grant_name = "MIDA Domestic Investment Strategic Fund (DISF) Automation"
    agency = "MIDA"
    matching_percentage = 60
    cap_myr = 500000.0
    min_capex_myr = 250000.0
    min_turnover_myr = 500000.0
    eligible_categories = [InvoiceItemCategory.AUTOMATION_HARDWARE]
    required_documents = [
        "MIDA Manufacturing License / ICA10 Exemption Letter",
        "SSM Corporate Profile (Form 9, 24 & 49)",
        "Latest 3-Year Audited Financial Statements",
        "Machinery Technical Blueprint & ROI Assessment",
    ]
    next_step = "Prepare a factory automation project of at least RM 250,000 with machinery quotations and an ROI assessment, then apply to MIDA before committing the purchase."

    def profile_checks(self, company: SMEProfile) -> List[RuleCheckResult]:
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

        # 4. Minimum Turnover >= RM 500,000
        turnover_pass = company.annualTurnoverMYR >= self.min_turnover_myr
        checks.append(RuleCheckResult(
            ruleName="Minimum Annual Turnover",
            passed=turnover_pass,
            requirement="Annual turnover ≥ RM 500,000",
            actual=f"RM {company.annualTurnoverMYR:,.0f}",
            reason="Meets MIDA strategic investment turnover threshold." if turnover_pass else "Annual turnover is below RM 500,000.",
            gapAdvice=None if turnover_pass else "MIDA DISF targets established manufacturers with at least RM 500,000 annual turnover. Smaller firms should consider SME Corp SAG."
        ))
        return checks

    def claim_checks(self, company: SMEProfile, invoice: Invoice) -> Tuple[List[RuleCheckResult], float]:
        # 5. High-value automation CapEx >= RM 250,000
        automation_total = category_total(invoice, self.eligible_categories)
        capex_pass = automation_total >= self.min_capex_myr
        return [RuleCheckResult(
            ruleName="High-Value Capital Machinery Threshold",
            passed=capex_pass,
            requirement="Automation CapEx ≥ RM 250,000",
            actual=f"Automation CapEx RM {automation_total:,.2f}",
            reason="Qualifies for MIDA strategic high-value capital automation co-funding." if capex_pass else "Does not meet strategic CapEx (≥ RM 250k) threshold.",
            gapAdvice=None if capex_pass else "MIDA DISF covers major factory automation upgrades (≥ RM 250,000). For smaller machinery (< RM 250k), apply under SME Corp Smart Automation Grant (SAG)."
        )], automation_total
