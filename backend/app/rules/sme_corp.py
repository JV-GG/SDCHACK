from typing import List, Tuple
from app.rules.base import BaseGrantRule, category_total
from app.models.schemas import SMEProfile, Invoice, RuleCheckResult, SectorType, InvoiceItemCategory


class SmeCorpSagRule(BaseGrantRule):
    grant_id = "SME_CORP_SAG"
    grant_name = "Smart Automation Grant (SAG)"
    agency = "SME Corp"
    matching_percentage = 50
    cap_myr = 1000000.0
    eligible_categories = [InvoiceItemCategory.AUTOMATION_HARDWARE]
    required_documents = [
        "Audited Financial Statements (Last 2 Years)",
        "Factory / Facility Site Plan & Machinery Layout",
        "SSM Corporate Profile & Shareholding Structure",
        "Automation Impact & Man-hour Reduction Justification",
    ]
    next_step = "Scope the automation project with a vendor, obtain machinery quotations and a man-hour reduction estimate, then apply before purchasing."

    def profile_checks(self, company: SMEProfile) -> List[RuleCheckResult]:
        checks = []

        # 1. Equity: >= 51% Malaysian equity
        equity_pass = company.malaysianEquityPercentage >= 51.0
        checks.append(RuleCheckResult(
            ruleName="Malaysian Equity Ownership",
            passed=equity_pass,
            requirement="≥ 51% Malaysian ownership",
            actual=f"{company.malaysianEquityPercentage:.1f}% Malaysian equity",
            reason="Satisfies SME Corp Malaysian equity mandate." if equity_pass else "Does not meet 51% Malaysian equity criterion.",
            gapAdvice=None if equity_pass else "SME Corp requires minimum 51% Malaysian shareholding recorded in SSM BizProfile."
        ))

        # 2. Tenure: >= 12 months in operation
        tenure_pass = company.tenureMonths >= 12
        checks.append(RuleCheckResult(
            ruleName="Operational Tenure",
            passed=tenure_pass,
            requirement="≥ 12 months active operation",
            actual=f"{company.tenureMonths} months in business",
            reason="Tenure requirement verified." if tenure_pass else "Company operating for less than 12 months.",
            gapAdvice=None if tenure_pass else "Must be actively operating for at least 12 months before applying for SAG."
        ))

        # 3. Non-GLC/MNC ownership
        glc_pass = not company.isGlcOrMncOwned
        checks.append(RuleCheckResult(
            ruleName="Non-GLC / Non-MNC Status",
            passed=glc_pass,
            requirement="< 20% GLC/MNC corporate holding",
            actual="Independent SME" if glc_pass else "GLC/MNC owned",
            reason="Qualifies as autonomous private SME." if glc_pass else "Disqualified due to GLC/MNC ownership.",
            gapAdvice=None if glc_pass else "Government-linked or multinational ownership must remain under 20% to qualify as an SME."
        ))

        # 4. SME Corp Sector Definition (Turnover & Headcount)
        if company.sector == SectorType.SERVICES:
            size_pass = company.annualTurnoverMYR <= 20000000.0 or company.fullTimeEmployees <= 75
            size_desc = f"Services (Turnover: RM {company.annualTurnoverMYR:,.0f} [max 20M], FTE: {company.fullTimeEmployees} [max 75])"
            size_advice = "Services firms must maintain <= 75 FTEs or annual sales <= RM 20 Million to qualify."
        else:
            size_pass = company.annualTurnoverMYR <= 50000000.0 or company.fullTimeEmployees <= 200
            size_desc = f"Manufacturing (Turnover: RM {company.annualTurnoverMYR:,.0f} [max 50M], FTE: {company.fullTimeEmployees} [max 200])"
            size_advice = "Manufacturing enterprises must maintain <= 200 FTEs or annual sales <= RM 50 Million."

        checks.append(RuleCheckResult(
            ruleName="SME Corp Size Classification",
            passed=size_pass,
            requirement="Under SME Corp national qualification ceilings",
            actual=size_desc,
            reason="Qualifies under SME Corp official classification threshold." if size_pass else "Exceeds SME threshold (classified as large enterprise).",
            gapAdvice=None if size_pass else size_advice
        ))
        return checks

    def claim_checks(self, company: SMEProfile, invoice: Invoice) -> Tuple[List[RuleCheckResult], float]:
        # 5. Automation Category Check
        automation_items_total = category_total(invoice, self.eligible_categories)
        category_pass = automation_items_total > 0
        return [RuleCheckResult(
            ruleName="Automation Hardware / Workflow Scope",
            passed=category_pass,
            requirement="Invoice must include industrial hardware or smart automation workflows",
            actual=f"RM {automation_items_total:,.2f} automation equipment items",
            reason="Eligible automation scope identified." if category_pass else "No automation hardware or machinery found in claim expenditure.",
            gapAdvice=None if category_pass else "SAG requires machinery, industrial robotics, or smart workflow hardware. For pure software, apply for MDEC MSME Digital Grant instead."
        )], automation_items_total
