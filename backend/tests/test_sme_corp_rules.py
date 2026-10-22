from app.models.schemas import SMEProfile, Invoice, InvoiceLineItem, InvoiceItemCategory, SectorType
from app.rules.sme_corp import SmeCorpSagRule

def test_sme_corp_sag_pass():
    company = SMEProfile(
        companyName="Penang Precision Machining Sdn Bhd",
        registrationNumber="20180109999",
        incorporationDate="2018-05-10",
        tenureMonths=72,
        malaysianEquityPercentage=100.0,
        annualTurnoverMYR=12000000.0,
        fullTimeEmployees=45,
        sector=SectorType.MANUFACTURING,
        isGlcOrMncOwned=False,
        isActiveExporter=True
    )
    invoice = Invoice(
        invoiceNumber="INV-SAG-501",
        invoiceDate="2026-10-15",
        vendorName="RoboTech Automation Sdn Bhd",
        vendorIsMdecTsp=False,
        totalAmountMYR=200000.0,
        items=[
            InvoiceLineItem(
                id="item-robotic-arm",
                description="6-Axis High Precision Robotic Sorting Arm & PLC Integration",
                category=InvoiceItemCategory.AUTOMATION_HARDWARE,
                quantity=1,
                unitPriceMYR=200000.0,
                totalPriceMYR=200000.0
            )
        ]
    )
    rule = SmeCorpSagRule()
    eval_result = rule.evaluate(company, invoice)

    assert eval_result.isEligible is True
    assert eval_result.maxCoFundingMYR == 100000.0  # 50% matching
    assert len(eval_result.requiredDocuments) == 4

def test_sme_corp_sag_fails_software_only():
    company = SMEProfile(
        companyName="Penang Precision Machining Sdn Bhd",
        registrationNumber="20180109999",
        incorporationDate="2018-05-10",
        tenureMonths=72,
        malaysianEquityPercentage=100.0,
        annualTurnoverMYR=12000000.0,
        fullTimeEmployees=45,
        sector=SectorType.MANUFACTURING
    )
    invoice = Invoice(
        invoiceNumber="INV-SW-101",
        invoiceDate="2026-10-15",
        vendorName="Accounting Soft",
        totalAmountMYR=15000.0,
        items=[
            InvoiceLineItem(
                id="item-sw",
                description="General Accounting Software License",
                category=InvoiceItemCategory.DIGITAL_ERP,
                quantity=1,
                unitPriceMYR=15000.0,
                totalPriceMYR=15000.0
            )
        ]
    )
    rule = SmeCorpSagRule()
    eval_result = rule.evaluate(company, invoice)

    assert eval_result.isEligible is False
    hardware_check = next(c for c in eval_result.checks if c.ruleName == "Automation Hardware / Workflow Scope")
    assert hardware_check.passed is False
    assert "MDEC MSME Digital Grant" in hardware_check.gapAdvice
