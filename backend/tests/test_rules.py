from app.models.schemas import (
    SMEProfile,
    Invoice,
    InvoiceLineItem,
    InvoiceItemCategory,
    SectorType
)
from app.services.evaluator import evaluate_claim_package

def test_mdec_digital_grant_eligible():
    company = SMEProfile(
        companyName="Test Retail Sdn Bhd",
        registrationNumber="202201012345",
        incorporationDate="2022-01-01",
        tenureMonths=24,
        malaysianEquityPercentage=80.0,
        annualTurnoverMYR=200000.0,
        fullTimeEmployees=10,
        sector=SectorType.SERVICES,
        isGlcOrMncOwned=False,
        isActiveExporter=False
    )

    invoice = Invoice(
        invoiceNumber="INV-1001",
        invoiceDate="2026-10-01",
        vendorName="MDEC Certified TSP Partner",
        vendorIsMdecTsp=True,
        totalAmountMYR=8000.0,
        items=[
            InvoiceLineItem(
                id="1",
                description="Cloud POS & e-Invoicing Suite",
                category=InvoiceItemCategory.E_INVOICING,
                quantity=1,
                unitPriceMYR=8000.0,
                totalPriceMYR=8000.0
            )
        ]
    )

    pkg = evaluate_claim_package(company, invoice)
    assert pkg.status == "EVALUATED"

    # Find MDEC evaluation
    mdec_eval = next((e for e in pkg.evaluations if e.grantId == "MDEC_MSME_DIGITAL"), None)
    assert mdec_eval is not None
    assert mdec_eval.isEligible is True
    assert mdec_eval.maxCoFundingMYR == 4000.0  # 50% of RM8000, max 5000

    # Ensure narratives generated
    assert len(pkg.narratives) >= 1
    assert pkg.narratives[0].grantId == "MDEC_MSME_DIGITAL"
