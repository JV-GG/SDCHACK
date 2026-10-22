from app.rules.base import BaseGrantRule
from app.models.schemas import SMEProfile, Invoice, GrantEvaluation, RuleCheckResult, InvoiceItemCategory

class HrdCorpSblRule(BaseGrantRule):
    grant_id = "HRD_CORP_SBL"
    grant_name = "HRD Corp SBL-Khas Digital & Technical Training Grant"
    agency = "HRD Corp"
    matching_percentage = 100
    cap_myr = 25000.0

    def evaluate(self, company: SMEProfile, invoice: Invoice) -> GrantEvaluation:
        checks = []

        # 1. Malaysian Equity >= 51%
        equity_pass = company.malaysianEquityPercentage >= 51.0
        checks.append(RuleCheckResult(
            ruleName="Malaysian Equity Ownership",
            passed=equity_pass,
            requirement="≥ 51% Malaysian shareholding",
            actual=f"{company.malaysianEquityPercentage:.1f}% Malaysian equity",
            reason="Meets HRD Corp PSMB Act Malaysian employer criteria." if equity_pass else "Below 51% Malaysian ownership.",
            gapAdvice=None if equity_pass else "HRD Corp SBL-Khas requires a Malaysian-incorporated employer with at least 51% local shareholding."
        ))

        # 2. Mandatory HRD Corp Levy Headcount (>= 10 full-time Malaysian employees)
        fte_pass = company.fullTimeEmployees >= 10
        checks.append(RuleCheckResult(
            ruleName="HRD Corp Levy Employer Threshold",
            passed=fte_pass,
            requirement="≥ 10 full-time Malaysian employees (Mandatory Levy Tier)",
            actual=f"{company.fullTimeEmployees} full-time employees",
            reason="Qualifies as mandatory HRD Corp levy-paying employer." if fte_pass else "Below 10 FTE mandatory levy threshold.",
            gapAdvice=None if fte_pass else "Companies with 5–9 employees must upload Form 1 Voluntary HRD Corp Registration Certificate; ≥ 10 FTEs qualify automatically."
        ))

        # 3. Operational Tenure >= 6 months
        tenure_pass = company.tenureMonths >= 6
        checks.append(RuleCheckResult(
            ruleName="Operational Tenure",
            passed=tenure_pass,
            requirement="≥ 6 months active operation & levy contribution",
            actual=f"{company.tenureMonths} months in business",
            reason="Active operational and levy contribution tenure verified." if tenure_pass else "Less than 6 months operating history.",
            gapAdvice=None if tenure_pass else "Employer must have at least 6 months of active operation and up-to-date HRD levy contributions."
        ))

        # 4. HR / Workforce Upskilling & Payroll Digitalisation Scope
        eligible_total = sum(
            item.totalPriceMYR for item in invoice.items
            if item.category == InvoiceItemCategory.HR_PAYROLL
        )
        scope_pass = eligible_total > 0
        checks.append(RuleCheckResult(
            ruleName="HR & Workforce Training Expenditure Scope",
            passed=scope_pass,
            requirement="Invoice must contain HR/Payroll or certified workforce training line items",
            actual=f"RM {eligible_total:,.2f} eligible HR/training items",
            reason="Eligible HR/workforce training items verified." if scope_pass else "No HR, payroll, or accredited technical training items found in invoice.",
            gapAdvice=None if scope_pass else "Include certified HRD Corp training course fees or HR/Payroll system implementation costs on the invoice."
        ))

        all_passed = all(c.passed for c in checks)
        co_funding = min(eligible_total * (self.matching_percentage / 100.0), self.cap_myr) if all_passed else 0.0

        required_docs = [
            "HRD Corp Employer Registration Certificate (Form 1)",
            "Latest 3-Month HRD Levy Payment Receipts (MyCoID)",
            "HRD Corp Accredited Training Provider Quotation / Invoice",
            "Trainee MyKad Roster & Course Syllabus Schedule"
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
