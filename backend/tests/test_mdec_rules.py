from app.models.schemas import SMEProfile, Invoice, InvoiceLineItem, InvoiceItemCategory, SectorType
from app.rules.mdec import MdecDigitalGrantRule

def test_mdec_rule_pass():
    company = SMEProfile(
        companyName="Test MDEC Co",
        registrationNumber="12345",
        incorporationDate="2022-01-01",
        tenureMonths=24,
        malaysianEquityPercentage=65.0,
        annualTurnoverMYR=120000.0,
        fullTimeEmployees=12,
        sector=SectorType.SERVICES,
        isGlcOrMncOwned=False,
        isActiveExporter=False
    )
    invoice = Invoice(
        invoiceNumber="INV-001",
        invoiceDate="2026-10-01",
        vendorName="CloudTech (TSP #01)",
        vendorIsMdecTsp=True,
        totalAmountMYR=6000.0,
        items=[
            InvoiceLineItem(
                id="1",
                description="POS & e-Invoicing",
                category=InvoiceItemCategory.E_INVOICING,
                quantity=1,
                unitPriceMYR=6000.0,
                totalPriceMYR=6000.0
            )
        ]
    )
    rule = MdecDigitalGrantRule()
    eval_result = rule.evaluate(company, invoice)

    assert eval_result.isEligible is True
    assert eval_result.maxCoFundingMYR == 3000.0  # 50% of RM6,000
    assert len(eval_result.requiredDocuments) == 4

def test_mdec_rule_fails_non_tsp():
    company = SMEProfile(
        companyName="Test MDEC Co",
        registrationNumber="12345",
        incorporationDate="2022-01-01",
        tenureMonths=24,
        malaysianEquityPercentage=80.0,
        annualTurnoverMYR=120000.0,
        fullTimeEmployees=12,
        sector=SectorType.SERVICES
    )
    invoice = Invoice(
        invoiceNumber="INV-002",
        invoiceDate="2026-10-01",
        vendorName="Generic Vendor",
        vendorIsMdecTsp=False,  # Fails TSP requirement
        totalAmountMYR=6000.0,
        items=[
            InvoiceLineItem(
                id="1",
                description="POS & e-Invoicing",
                category=InvoiceItemCategory.E_INVOICING,
                quantity=1,
                unitPriceMYR=6000.0,
                totalPriceMYR=6000.0
            )
        ]
    )
    rule = MdecDigitalGrantRule()
    eval_result = rule.evaluate(company, invoice)

    assert eval_result.isEligible is False
    assert eval_result.maxCoFundingMYR == 0.0

    tsp_check = next(c for c in eval_result.checks if c.ruleName == "Approved Technology Solution Provider (TSP)")
    assert tsp_check.passed is False
    assert tsp_check.gapAdvice is not None
    assert "accredited MDEC TSP" in tsp_check.gapAdvice
