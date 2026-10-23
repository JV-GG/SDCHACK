from typing import List, Tuple
from app.rules.base import BaseGrantRule, category_total
from app.models.schemas import SMEProfile, Invoice, RuleCheckResult, InvoiceItemCategory


class MdecDigitalGrantRule(BaseGrantRule):
    grant_id = "MDEC_MSME_DIGITAL"
    grant_name = "MSME Digital Grant MADANI (SME Digitalisation Grant)"
    agency = "MDEC"
    matching_percentage = 50
    cap_myr = 5000.0
    eligible_categories = [
        InvoiceItemCategory.DIGITAL_ERP,
        InvoiceItemCategory.HR_PAYROLL,
        InvoiceItemCategory.E_INVOICING,
    ]
    required_documents = [
        "SSM BizProfile Form (e-Info)",
        "Latest 2-Month Bank Account Statements",
        "MDEC TSP Official Quotation / Tax Invoice",
        "Signed Grant Declaration Letter",
    ]
    next_step = "Request a quotation from an MDEC-accredited TSP for e-Invoicing, ERP or HR/Payroll software, then apply with that quotation before purchasing."

    def profile_checks(self, company: SMEProfile) -> List[RuleCheckResult]:
        checks = []

        # 1. Equity Rule: >= 60% Malaysian ownership
        equity_pass = company.malaysianEquityPercentage >= 60.0
        checks.append(RuleCheckResult(
            ruleName="Malaysian Equity Ownership",
            passed=equity_pass,
            requirement="≥ 60% Malaysian equity ownership",
            actual=f"{company.malaysianEquityPercentage:.1f}% Malaysian equity",
            reason="Meets statutory MSME Digital Grant requirements." if equity_pass else "Does not satisfy minimum 60% Malaysian ownership.",
            gapAdvice=None if equity_pass else "SME requires at least 60% local equity. Alternatively, consider SME Corp SAG which requires 51% local equity."
        ))

        # 2. Tenure Rule: >= 6 months in operation
        tenure_pass = company.tenureMonths >= 6
        checks.append(RuleCheckResult(
            ruleName="Operational Tenure",
            passed=tenure_pass,
            requirement="≥ 6 months active operation",
            actual=f"{company.tenureMonths} months in business",
            reason="Verified active operating tenure." if tenure_pass else "Business operational for less than 6 months.",
            gapAdvice=None if tenure_pass else "Grant requires minimum 6 months in business from official SSM incorporation date."
        ))

        # 3. Minimum Turnover: >= RM50,000
        turnover_pass = company.annualTurnoverMYR >= 50000.0
        checks.append(RuleCheckResult(
            ruleName="Annual Sales Turnover",
            passed=turnover_pass,
            requirement="Min RM 50,000 annual sales turnover",
            actual=f"RM {company.annualTurnoverMYR:,.2f}",
            reason="Meets minimum turnover threshold." if turnover_pass else "Annual turnover is below RM 50,000.",
            gapAdvice=None if turnover_pass else "Ensure full annual sales turnover from your Orbyte financial records is synchronized."
        ))
        return checks

    def claim_checks(self, company: SMEProfile, invoice: Invoice) -> Tuple[List[RuleCheckResult], float]:
        checks = []

        # 4. TSP Accreditation Check
        tsp_pass = invoice.vendorIsMdecTsp
        checks.append(RuleCheckResult(
            ruleName="Approved Technology Solution Provider (TSP)",
            passed=tsp_pass,
            requirement="Vendor must be an accredited MDEC TSP",
            actual=f"{invoice.vendorName} ({'Accredited TSP' if tsp_pass else 'Not on TSP Whitelist'})",
            reason="Vendor verified against MDEC TSP registry." if tsp_pass else "Vendor is not accredited as an MDEC TSP.",
            gapAdvice=None if tsp_pass else "Switch vendor or request quotation from an accredited MDEC TSP partner to unlock matching funds."
        ))

        # 5. Eligible Digital Category Check
        eligible_items_total = category_total(invoice, self.eligible_categories)
        category_pass = eligible_items_total > 0
        checks.append(RuleCheckResult(
            ruleName="Digital Category Incurred",
            passed=category_pass,
            requirement="Invoice must include eligible digital categories (e-Invoicing, ERP, HR/Payroll)",
            actual=f"RM {eligible_items_total:,.2f} eligible digital items",
            reason="Eligible digitalisation line items detected." if category_pass else "No qualifying digital software/service categories found.",
            gapAdvice=None if category_pass else "Qualifying expenditures include e-Invoicing modules, Cloud ERP, and HR/Payroll software."
        ))
        return checks, eligible_items_total
