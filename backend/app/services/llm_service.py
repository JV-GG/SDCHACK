import json
import logging
from typing import List, Optional
from app.models.schemas import SMEProfile, Invoice, GrantEvaluation, LLMNarrative
from app.core.config import settings

logger = logging.getLogger(__name__)

def generate_grant_narrative(
    company: SMEProfile,
    invoice: Invoice,
    evaluation: GrantEvaluation
) -> LLMNarrative:
    """
    Generates required grant justification narrative.
    Falls back to structured intelligent templates if GEMINI_API_KEY is not configured.
    """
    if settings.GEMINI_API_KEY:
        try:
            import google.generativeai as genai
            genai.configure(api_key=settings.GEMINI_API_KEY)
            model = genai.GenerativeModel("gemini-1.5-flash")

            prompt = f"""
            You are an expert Malaysian grant consultant.
            Generate a formal project justification and ROI narrative for an SME grant application.

            Grant: {evaluation.grantName} ({evaluation.agency})
            Company: {company.companyName}
            Sector: {company.sector.value}
            Headcount: {company.fullTimeEmployees} FTEs
            Turnover: RM {company.annualTurnoverMYR:,.2f}

            Expenditure:
            Vendor: {invoice.vendorName}
            Total: RM {invoice.totalAmountMYR:,.2f}
            Items: {', '.join([item.description for item in invoice.items])}

            Return JSON format with exact keys:
            {{
              "projectTitle": "Clear concise project title",
              "transformationJustification": "2-3 sentences explaining operational bottleneck and need for this solution",
              "roiAndProductivityProjections": "2-3 sentences detailing expected man-hour savings, error reduction, and financial ROI",
              "marketOrExportReadiness": "1-2 sentences on market expansion (if applicable)"
            }}
            """
            response = model.generate_content(
                prompt,
                generation_config={"response_mime_type": "application/json"}
            )
            data = json.loads(response.text)
            return LLMNarrative(
                grantId=evaluation.grantId,
                projectTitle=data.get("projectTitle", f"Digital Transformation for {company.companyName}"),
                transformationJustification=data.get("transformationJustification", ""),
                roiAndProductivityProjections=data.get("roiAndProductivityProjections", ""),
                marketOrExportReadiness=data.get("marketOrExportReadiness", "")
            )
        except Exception as e:
            logger.warning(f"Gemini API invocation failed, falling back to deterministic template: {e}")

    # High-quality fallback template based on grant type
    item_names = ", ".join([item.description for item in invoice.items[:2]])
    if evaluation.grantId == "MDEC_MSME_DIGITAL":
        return LLMNarrative(
            grantId=evaluation.grantId,
            projectTitle=f"Digitalisation of Business Workflow via {item_names}",
            transformationJustification=(
                f"{company.companyName} currently relies on fragmented manual documentation across its {company.fullTimeEmployees} workforce. "
                f"Implementing the accredited TSP solution ({invoice.vendorName}) automates daily transactions, ensures statutory compliance (such as LHDN e-Invoicing), "
                f"and eliminates double-handling between accounting and operational teams."
            ),
            roiAndProductivityProjections=(
                f"Expected to reduce order processing overhead by 40% and save approximately 50 man-hours monthly. "
                f"Provides real-time visibility into operational margins on the current RM {company.annualTurnoverMYR:,.0f} annual sales turnover."
            )
        )
    elif evaluation.grantId == "SME_CORP_SAG":
        return LLMNarrative(
            grantId=evaluation.grantId,
            projectTitle=f"Smart Automation & Productivity Upgrade: {item_names}",
            transformationJustification=(
                f"To scale production capacity without linear labor growth, {company.companyName} is integrating "
                f"automated machinery. This replaces manual bottleneck stages and increases output consistency."
            ),
            roiAndProductivityProjections=(
                f"Projects a 35% improvement in cycle throughput and a 20% reduction in raw material scrap rates within 12 months."
            )
        )
    else:
        return LLMNarrative(
            grantId=evaluation.grantId,
            projectTitle=f"International Market Expansion via {item_names}",
            transformationJustification=(
                f"Targeting cross-border market penetration for Made-in-Malaysia goods/services by participating in trade missions and digital showcases."
            ),
            roiAndProductivityProjections=(
                f"Anticipates generating new international buyer inquiries and establishing 3-5 overseas distribution leads within the fiscal year."
            ),
            marketOrExportReadiness="Pre-qualified Malaysian business with established local track record and export certification."
        )
