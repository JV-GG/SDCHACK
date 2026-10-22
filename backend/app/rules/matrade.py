from app.rules.base import BaseGrantRule
from app.models.schemas import SMEProfile, Invoice, GrantEvaluation, RuleCheckResult, InvoiceItemCategory

class MatradeMdgRule(BaseGrantRule):
    grant_id = "MATRADE_MDG"
    grant_name = "Market Development Grant (MDG)"
    agency = "MATRADE"
    matching_percentage = 100
    cap_myr = 300000.0

    def evaluate(self, company: SMEProfile, invoice: Invoice) -> GrantEvaluation:
        checks = []

        # 1. Equity: >= 60% Malaysian equity
        equity_pass = company.malaysianEquityPercentage >= 60.0
        checks.append(RuleCheckResult(
            ruleName="Malaysian Equity Ownership",
            passed=equity_pass,
            requirement="≥ 60% Malaysian ownership",
            actual=f"{company.malaysianEquityPercentage:.1f}% Malaysian equity",
            reason="Meets MATRADE Malaysian ownership policy." if equity_pass else "Does not meet 60% Malaysian equity criterion."
        ))

        # 2. Tenure: >= 12 months in operation
        tenure_pass = company.tenureMonths >= 12
        checks.append(RuleCheckResult(
            ruleName="Operational Tenure",
            passed=tenure_pass,
            requirement="≥ 12 months active operation",
            actual=f"{company.tenureMonths} months in business",
            reason="Operational tenure verified." if tenure_pass else "Company operating for less than 12 months."
        ))

        # 3. Exporter Status
        exporter_pass = company.isActiveExporter
        checks.append(RuleCheckResult(
            ruleName="Active Exporter Registration",
            passed=exporter_pass,
            requirement="Registered exporter of Made-in-Malaysia goods or services",
            actual="Active Registered Exporter" if exporter_pass else "Not registered as an active exporter",
            reason="Verified Malaysian exporter profile." if exporter_pass else "Company is not yet an active or registered exporter."
        ))

        # 4. Export Exhibition / Marketing Category
        export_items_total = sum(
            item.totalPriceMYR for item in invoice.items if item.category == InvoiceItemCategory.EXPORT_EXHIBITION
        )
        category_pass = export_items_total > 0
        checks.append(RuleCheckResult(
            ruleName="Export Promotion Expenditure Scope",
            passed=category_pass,
            requirement="Invoice must be for international trade fairs or export promotion",
            actual=f"RM {export_items_total:,.2f} export promotion expenses",
            reason="Eligible trade fair or export activity identified." if category_pass else "Invoice contains no qualifying international export activities."
        ))

        all_passed = all(c.passed for c in checks)
        co_funding = min(export_items_total, self.cap_myr) if all_passed else 0.0

        required_docs = [
            "MATRADE Exporter Registry Certificate",
            "Proof of International Exhibition / Booth Space Receipt",
            "Copy of Export Sales Orders / Commercial Invoices",
            "Product Brochure (Made-in-Malaysia Label)"
        ] if all_passed else []

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
