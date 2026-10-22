from app.rules.base import BaseGrantRule
from app.models.schemas import SMEProfile, Invoice, GrantEvaluation, RuleCheckResult, SectorType, InvoiceItemCategory

class MitiIndustry4wrdRule(BaseGrantRule):
    grant_id = "MITI_INDUSTRY4WRD"
    grant_name = "MITI Industry4WRD Intervention Fund"
    agency = "MITI"
    matching_percentage = 70
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
            reason="Meets MITI Industry4WRD 60% local shareholding mandate." if equity_pass else "Below 60% Malaysian ownership.",
            gapAdvice=None if equity_pass else "MITI Industry4WRD requires at least 60% Malaysian shareholding."
        ))

        # 2. Manufacturing SME Classification
        is_mfg_sme = (
            company.sector == SectorType.MANUFACTURING
            and (company.fullTimeEmployees <= 200 or company.annualTurnoverMYR <= 50000000.0)
        )
        checks.append(RuleCheckResult(
            ruleName="Manufacturing SME Classification",
            passed=is_mfg_sme,
            requirement="Manufacturing SME (≤ 200 FTEs or ≤ RM 50M annual turnover)",
            actual=f"{company.sector.value} ({company.fullTimeEmployees} FTEs, RM {company.annualTurnoverMYR:,.0f})",
            reason="Verified as qualifying Malaysian Manufacturing SME." if is_mfg_sme else "Not registered as a Manufacturing SME.",
            gapAdvice=None if is_mfg_sme else "Industry4WRD Intervention Fund is exclusively for Manufacturing SMEs that have completed the MPC Readiness Assessment."
        ))

        # 3. Operational Tenure >= 36 months
        tenure_pass = company.tenureMonths >= 36
        checks.append(RuleCheckResult(
            ruleName="Operational Tenure",
            passed=tenure_pass,
            requirement="≥ 36 months active operation",
            actual=f"{company.tenureMonths} months in business",
            reason="Meets 3-year operational history requirement." if tenure_pass else "Company operating for less than 36 months.",
            gapAdvice=None if tenure_pass else "Requires minimum 36 months (3 years) in active manufacturing operation."
        ))

        # 4. Cyber-Physical Industry 4.0 Scope (Requires BOTH DIGITAL_ERP and AUTOMATION_HARDWARE)
        erp_total = sum(
            item.totalPriceMYR for item in invoice.items
            if item.category == InvoiceItemCategory.DIGITAL_ERP
        )
        hw_total = sum(
            item.totalPriceMYR for item in invoice.items
            if item.category == InvoiceItemCategory.AUTOMATION_HARDWARE
        )
        combined_pass = erp_total > 0 and hw_total > 0
        combined_total = erp_total + hw_total if combined_pass else 0.0
        checks.append(RuleCheckResult(
            ruleName="Industry 4.0 Cyber-Physical Integration Scope",
            passed=combined_pass,
            requirement="Invoice must combine Digital ERP/MES software AND Automation Hardware/IoT",
            actual=f"ERP/MES: RM {erp_total:,.2f} · Automation/IoT: RM {hw_total:,.2f}",
            reason="Cyber-physical Industry 4.0 software + hardware bundle verified." if combined_pass else "Missing combined software (ERP/MES) + hardware (IoT/Robotics) integration.",
            gapAdvice=None if combined_pass else "Industry4WRD funds holistic Industry 4.0 shifts combining both Digital ERP/MES software and shopfloor Automation Hardware on the project scope."
        ))

        all_passed = all(c.passed for c in checks)
        co_funding = min(combined_total * (self.matching_percentage / 100.0), self.cap_myr) if all_passed else 0.0

        required_docs = [
            "MPC Industry4WRD Readiness Assessment (RA) Approval Certificate",
            "MIDA Manufacturing License / Municipal Business License",
            "3-Year Audited Financial Statements",
            "Industry 4.0 System Integrator Proposal & Quotation"
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
