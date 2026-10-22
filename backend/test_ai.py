import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load backend/.env
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

from app.core.config import settings
from app.models.schemas import (
    SMEProfile,
    Invoice,
    InvoiceLineItem,
    InvoiceItemCategory,
    SectorType,
    GrantEvaluation
)
from app.services.llm_service import generate_grant_narrative

def main():
    print("=" * 60)
    print("🔍 Testing SME Grant Copilot AI Narrative Engine")
    print("=" * 60)

    if not settings.DEEPSEEK_API_KEY:
        print("⚠️  Notice: DEEPSEEK_API_KEY is not set in backend/.env")
        print("   Create backend/.env with:")
        print('   DEEPSEEK_API_KEY="sk-your-key-here"')
        print("   (Testing fallback intelligent template instead...)\n")
    else:
        key_preview = settings.DEEPSEEK_API_KEY[:6] + "..." + settings.DEEPSEEK_API_KEY[-4:]
        print(f"✅ Found DEEPSEEK_API_KEY: {key_preview}")
        print(f"   Endpoint: {settings.DEEPSEEK_BASE_URL}")
        print(f"   Model: {settings.DEEPSEEK_MODEL}\n")

    company = SMEProfile(
        companyName="Nusantara Retail Solutions Sdn Bhd",
        registrationNumber="202101045892",
        incorporationDate="2021-04-15",
        tenureMonths=42,
        malaysianEquityPercentage=85.0,
        annualTurnoverMYR=480000.0,
        fullTimeEmployees=8,
        sector=SectorType.SERVICES,
        isGlcOrMncOwned=False,
        isActiveExporter=False
    )

    invoice = Invoice(
        invoiceNumber="INV-MDEC-9082",
        invoiceDate="2026-10-18",
        vendorName="CloudTech Malaysia Sdn Bhd (MDEC TSP #0421)",
        vendorIsMdecTsp=True,
        totalAmountMYR=10000.0,
        items=[
            InvoiceLineItem(
                id="item-1",
                description="LHDN e-Invoicing Compliance Module & Multi-store POS",
                category=InvoiceItemCategory.E_INVOICING,
                quantity=1,
                unitPriceMYR=6000.0,
                totalPriceMYR=6000.0
            ),
            InvoiceLineItem(
                id="item-2",
                description="Cloud ERP & Inventory Automation",
                category=InvoiceItemCategory.DIGITAL_ERP,
                quantity=1,
                unitPriceMYR=4000.0,
                totalPriceMYR=4000.0
            )
        ]
    )

    evaluation = GrantEvaluation(
        grantId="MDEC_MSME_DIGITAL",
        grantName="MSME Digital Grant MADANI",
        agency="MDEC",
        isEligible=True,
        maxCoFundingMYR=5000.0,
        matchingPercentage=50,
        checks=[],
        requiredDocuments=[]
    )

    print("🤖 Calling AI Grant Narrator for MDEC MSME Digital Grant...")
    narrative = generate_grant_narrative(company, invoice, evaluation)

    print("\n" + "-" * 60)
    print("📝 GENERATED APPLICATION NARRATIVE:")
    print("-" * 60)
    print(f"📌 Project Title:\n   {narrative.projectTitle}\n")
    print(f"🏢 Operational Transformation Justification:\n   {narrative.transformationJustification}\n")
    print(f"📈 ROI & Productivity Projections:\n   {narrative.roiAndProductivityProjections}\n")
    print("-" * 60)
    print("✨ Test completed successfully!\n")

if __name__ == "__main__":
    main()
