from app.models.schemas import SMEProfile, Invoice, InvoiceLineItem, InvoiceItemCategory, SectorType
from app.rules.matrade import MatradeMdgRule

def test_matrade_mdg_pass():
    company = SMEProfile(
        companyName="Bumi Spices Export Sdn Bhd",
        registrationNumber="20190104433",
        incorporationDate="2019-03-01",
        tenureMonths=60,
        malaysianEquityPercentage=75.0,
        annualTurnoverMYR=3500000.0,
        fullTimeEmployees=18,
        sector=SectorType.MANUFACTURING,
        isGlcOrMncOwned=False,
        isActiveExporter=True  # Registered exporter
    )
    invoice = Invoice(
        invoiceNumber="INV-MDG-880",
        invoiceDate="2026-09-20",
        vendorName="Dubai World Trade Centre Exhibition Organisers",
        vendorIsMdecTsp=False,
        totalAmountMYR=25000.0,
        items=[
            InvoiceLineItem(
                id="item-booth",
                description="Gulfood 2026 Malaysia Pavilion Standard Shell Scheme Booth",
                category=InvoiceItemCategory.EXPORT_EXHIBITION,
                quantity=1,
                unitPriceMYR=25000.0,
                totalPriceMYR=25000.0
            )
        ]
    )
    rule = MatradeMdgRule()
    eval_result = rule.evaluate(company, invoice)

    assert eval_result.isEligible is True
    assert eval_result.maxCoFundingMYR == 25000.0  # 100% reimbursable up to 300k
    assert len(eval_result.requiredDocuments) == 4

def test_matrade_mdg_fails_non_exporter():
    company = SMEProfile(
        companyName="Local Only Bakery Sdn Bhd",
        registrationNumber="20200108877",
        incorporationDate="2020-01-01",
        tenureMonths=36,
        malaysianEquityPercentage=100.0,
        annualTurnoverMYR=400000.0,
        fullTimeEmployees=6,
        sector=SectorType.SERVICES,
        isActiveExporter=False  # Not registered as exporter
    )
    invoice = Invoice(
        invoiceNumber="INV-MDG-999",
        invoiceDate="2026-09-20",
        vendorName="Overseas Expo",
        totalAmountMYR=10000.0,
        items=[
            InvoiceLineItem(
                id="item-booth",
                description="International Expo Booth",
                category=InvoiceItemCategory.EXPORT_EXHIBITION,
                quantity=1,
                unitPriceMYR=10000.0,
                totalPriceMYR=10000.0
            )
        ]
    )
    rule = MatradeMdgRule()
    eval_result = rule.evaluate(company, invoice)

    assert eval_result.isEligible is False
    exporter_check = next(c for c in eval_result.checks if c.ruleName == "Active Exporter Registration")
    assert exporter_check.passed is False
    assert "MATRADE Exporter Registry" in exporter_check.gapAdvice
