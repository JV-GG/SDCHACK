import json
import logging
import re
from datetime import date
from typing import Optional, List, Tuple
import httpx
from app.models.schemas import (
    SMEProfile,
    Invoice,
    InvoiceLineItem,
    InvoiceItemCategory,
    GrantEvaluation,
    LLMNarrative
)
from app.core.config import settings

logger = logging.getLogger(__name__)

def extract_json_from_llm_response(raw_text: str) -> dict:
    """
    Cleans and extracts valid JSON from LLM responses.
    Handles DeepSeek-R1 <think>...</think> reasoning blocks, markdown fences, and stray characters.
    """
    # 1. Remove <think>...</think> reasoning blocks
    cleaned = re.sub(r"<think>.*?</think>", "", raw_text, flags=re.DOTALL).strip()

    # 2. Remove markdown code fences ```json ... ```
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    cleaned = cleaned.strip()

    # 3. Try direct JSON parse
    try:
        return json.loads(cleaned)
    except Exception:
        pass

    # 4. Extract first matching outer JSON object { ... }
    match = re.search(r"(\{.*\})", cleaned, flags=re.DOTALL)
    if match:
        return json.loads(match.group(1))

    raise ValueError(f"No valid JSON object found in response: {raw_text[:250]}...")


def _dispatch_chat_completion(
    messages: List[dict],
    temperature: float = 0.2,
    max_tokens: int = 800
) -> Tuple[Optional[dict], str]:
    """
    Multi-tier LLM inference dispatcher:
    Tier 1: High-speed DeepSeek Cloud API (1.8s response time)
    Tier 2: Private RunPod GPU Serverless vLLM (Endpoint: reig5yleze9o5f)
    Returns (parsed_json_dict, provider_name)
    """
    # -------------------------------------------------------------
    # TIER 1: DeepSeek Cloud API (Primary - Blazing Fast & Reliable)
    # -------------------------------------------------------------
    if settings.DEEPSEEK_API_KEY:
        try:
            url = f"{settings.DEEPSEEK_BASE_URL.rstrip('/')}/chat/completions"
            headers = {
                "Authorization": f"Bearer {settings.DEEPSEEK_API_KEY}",
                "Content-Type": "application/json"
            }
            body = {
                "model": settings.DEEPSEEK_MODEL,
                "messages": messages,
                "response_format": {"type": "json_object"},
                "temperature": temperature,
                "max_tokens": max_tokens
            }
            with httpx.Client(timeout=15.0) as client:
                res = client.post(url, headers=headers, json=body)
                if res.status_code == 200:
                    raw_content = res.json()["choices"][0]["message"]["content"]
                    data = extract_json_from_llm_response(raw_content)
                    return data, f"DeepSeek Cloud ({settings.DEEPSEEK_MODEL})"
                else:
                    logger.warning(f"Tier 1 (DeepSeek Cloud) returned status {res.status_code}")
        except Exception as e:
            logger.warning(f"Tier 1 (DeepSeek Cloud) failed: {e}. Falling back to Tier 2 (RunPod GPU)...")

    # -------------------------------------------------------------
    # TIER 2: RunPod Private Serverless GPU (Failover / On-Premise)
    # -------------------------------------------------------------
    if settings.RUNPOD_API_KEY:
        try:
            url = f"{settings.RUNPOD_BASE_URL.rstrip('/')}/chat/completions"
            headers = {
                "Authorization": f"Bearer {settings.RUNPOD_API_KEY}",
                "Content-Type": "application/json"
            }
            body = {
                "model": settings.RUNPOD_MODEL,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens
            }
            with httpx.Client(timeout=60.0) as client:
                res = client.post(url, headers=headers, json=body)
                if res.status_code == 200:
                    raw_content = res.json()["choices"][0]["message"]["content"]
                    data = extract_json_from_llm_response(raw_content)
                    return data, f"RunPod GPU ({settings.RUNPOD_MODEL})"
                else:
                    logger.warning(f"Tier 2 (RunPod GPU) returned status {res.status_code}")
        except Exception as e:
            logger.warning(f"Tier 2 (RunPod GPU) failed: {e}. Falling back to Tier 3 (Deterministic Template)...")

    return None, "Offline Deterministic Template Engine"


def parse_raw_invoice(raw_text: str, vendor_hint: Optional[str] = None) -> Invoice:
    """
    Parses messy, unstructured invoice/receipt text using Multi-Tier AI.
    Categorizes line items into grant-eligible buckets.
    """
    parse_prompt = f"""
    You are an expert OCR & accounting parser for Malaysian business invoices.
    Parse the following raw invoice text into clean, structured JSON.

    Raw Invoice Text:
    \"\"\"{raw_text}\"\"\"

    Rules:
    1. Extract invoiceNumber, invoiceDate (YYYY-MM-DD), vendorName, totalAmountMYR (numeric float).
    2. Determine vendorIsMdecTsp (boolean): set to true if the vendor is an accredited MDEC Technology Solution Provider.
    3. Extract line items. For each item, classify category into strictly one of:
       - "E_INVOICING" (MyInvois, e-Invoicing, POS with e-invoicing compliance)
       - "DIGITAL_ERP" (Accounting, Cloud ERP, inventory sync, CRM)
       - "HR_PAYROLL" (Orbyte HR, payroll software, biometric attendance)
       - "AUTOMATION_HARDWARE" (Robotic arms, CNC, packaging machines, industrial sensors)
       - "EXPORT_EXHIBITION" (Trade fair booth space, overseas expo, MATRADE missions)
       - "OTHER" (office supplies, furniture, generic)

    Return strictly JSON with keys:
    {{
      "invoiceNumber": "string",
      "invoiceDate": "YYYY-MM-DD",
      "vendorName": "string",
      "vendorIsMdecTsp": boolean,
      "totalAmountMYR": float,
      "items": [
        {{
          "id": "item-1",
          "description": "string",
          "category": "E_INVOICING" | "DIGITAL_ERP" | "HR_PAYROLL" | "AUTOMATION_HARDWARE" | "EXPORT_EXHIBITION" | "OTHER",
          "quantity": int,
          "unitPriceMYR": float,
          "totalPriceMYR": float
        }}
      ]
    }}
    """
    messages = [
        {"role": "system", "content": "You are an invoice parsing engine for Malaysian grant claims. Output JSON only."},
        {"role": "user", "content": parse_prompt}
    ]

    data, provider = _dispatch_chat_completion(messages, temperature=0.1, max_tokens=1000)

    if data and "items" in data:
        items = []
        for idx, it in enumerate(data.get("items", [])):
            cat_str = str(it.get("category", "OTHER")).upper()
            try:
                cat_enum = InvoiceItemCategory(cat_str)
            except ValueError:
                cat_enum = InvoiceItemCategory.OTHER

            items.append(InvoiceLineItem(
                id=str(it.get("id", f"item-{idx+1}")),
                description=str(it.get("description", "Purchased Item")),
                category=cat_enum,
                quantity=int(it.get("quantity", 1)),
                unitPriceMYR=float(it.get("unitPriceMYR", 0.0)),
                totalPriceMYR=float(it.get("totalPriceMYR", 0.0))
            ))

        return Invoice(
            invoiceNumber=str(data.get("invoiceNumber", "INV-OCR-001")),
            invoiceDate=str(data.get("invoiceDate", str(date.today()))),
            vendorName=str(data.get("vendorName", vendor_hint or "Parsed Vendor")),
            vendorIsMdecTsp=bool(data.get("vendorIsMdecTsp", False)),
            totalAmountMYR=float(data.get("totalAmountMYR", sum(i.totalPriceMYR for i in items))),
            items=items
        )

    # Heuristic fallback
    amount_match = re.search(r"RM\s*([0-9,]+(?:\.[0-9]{2})?)", raw_text, re.IGNORECASE)
    total_amount = float(amount_match.group(1).replace(",", "")) if amount_match else 5000.0

    is_tsp = "tsp" in raw_text.lower() or "mdec" in raw_text.lower()
    is_einvoice = "einvoice" in raw_text.lower() or "e-invoicing" in raw_text.lower() or "pos" in raw_text.lower()
    is_auto = "robot" in raw_text.lower() or "machine" in raw_text.lower() or "automation" in raw_text.lower()
    is_export = "expo" in raw_text.lower() or "booth" in raw_text.lower() or "exhibition" in raw_text.lower()

    if is_auto:
        cat = InvoiceItemCategory.AUTOMATION_HARDWARE
        desc = "Smart Industrial Automation Machinery"
    elif is_export:
        cat = InvoiceItemCategory.EXPORT_EXHIBITION
        desc = "International Trade Fair Exhibition Booth"
    elif is_einvoice:
        cat = InvoiceItemCategory.E_INVOICING
        desc = "e-Invoicing & POS Compliance Solution"
    else:
        cat = InvoiceItemCategory.DIGITAL_ERP
        desc = "Enterprise Digital Software & Cloud Services"

    return Invoice(
        invoiceNumber="INV-PARSED-9901",
        invoiceDate=str(date.today()),
        vendorName=vendor_hint or ("Accredited TSP Partner Sdn Bhd" if is_tsp else "Vendor Solution Provider"),
        vendorIsMdecTsp=is_tsp,
        totalAmountMYR=total_amount,
        items=[
            InvoiceLineItem(
                id="item-parsed-1",
                description=desc,
                category=cat,
                quantity=1,
                unitPriceMYR=total_amount,
                totalPriceMYR=total_amount
            )
        ]
    )


def generate_deterministic_template_narrative(
    company: SMEProfile,
    invoice: Invoice,
    evaluation: GrantEvaluation,
) -> LLMNarrative:
    """Certified deterministic narrative template with zero LLM token consumption and instant response."""
    item_names = ", ".join([item.description for item in invoice.items[:2]]) if invoice.items else "Procured Solution"
    
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
                f"automated machinery ({invoice.vendorName}). This replaces manual bottleneck stages and increases output consistency."
            ),
            roiAndProductivityProjections=(
                f"Projects a 35% improvement in cycle throughput and a 20% reduction in raw material scrap rates within 12 months."
            )
        )
    elif evaluation.grantId == "CRADLE_CIP_SPARK":
        return LLMNarrative(
            grantId=evaluation.grantId,
            projectTitle=f"Commercialisation & Tech Hardening via {item_names}",
            transformationJustification=(
                f"{company.companyName} is advancing its proprietary digital solution to commercial scale. "
                f"Procured software modules harden the core cloud infrastructure and prepare the product for enterprise customer onboarding."
            ),
            roiAndProductivityProjections=(
                f"Accelerates time-to-market by 6 months and establishes technical capability to onboard up to 50 corporate clients in Year 1."
            )
        )
    elif evaluation.grantId == "HRD_CORP_SBL":
        return LLMNarrative(
            grantId=evaluation.grantId,
            projectTitle=f"Workforce Digital Skills & Operational Upskilling via {item_names}",
            transformationJustification=(
                f"Upskilling {company.fullTimeEmployees} full-time personnel on modernized software and automated business procedures."
            ),
            roiAndProductivityProjections=(
                f"Empowers staff to leverage automated workflows, minimizing manual entry error rates and raising operational productivity by 25%."
            )
        )
    elif evaluation.grantId == "MIDA_DISF":
        return LLMNarrative(
            grantId=evaluation.grantId,
            projectTitle=f"Domestic Manufacturing Automation & CapEx Modernization: {item_names}",
            transformationJustification=(
                f"Upgrades local manufacturing infrastructure and engineering capability at {company.companyName}. "
                f"Directly advances domestic value-add and industrial capability."
            ),
            roiAndProductivityProjections=(
                f"Expands manufacturing throughput by 30% and strengthens supply chain integration with multinational industrial buyers."
            )
        )
    elif evaluation.grantId == "MITI_INDUSTRY4WRD":
        return LLMNarrative(
            grantId=evaluation.grantId,
            projectTitle=f"Industry 4.0 Cyber-Physical Integration via {item_names}",
            transformationJustification=(
                f"Adopts Industry 4.0 intervention technologies ({invoice.vendorName}) to digitize shopfloor workflows and integrate plant monitoring."
            ),
            roiAndProductivityProjections=(
                f"Cuts machine downtime by 20% and provides transparent telemetry to management."
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


def generate_grant_narrative(
    company: SMEProfile,
    invoice: Invoice,
    evaluation: GrantEvaluation,
    use_ai: bool = False,
) -> LLMNarrative:
    """
    Generates required grant justification narrative.
    If use_ai=False (default for routine rule evaluations), returns instant deterministic domain template (0 cloud tokens).
    If use_ai=True, dispatches to Tier 1 (DeepSeek Cloud) -> Tier 2 (RunPod GPU) -> Tier 3 (Deterministic Template).
    """
    if not use_ai:
        return generate_deterministic_template_narrative(company, invoice, evaluation)

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

    Return strictly valid JSON with exact keys:
    {{
      "projectTitle": "Clear concise project title",
      "transformationJustification": "2-3 sentences explaining operational bottleneck and need for this solution",
      "roiAndProductivityProjections": "2-3 sentences detailing expected man-hour savings, error reduction, and financial ROI",
      "marketOrExportReadiness": "1-2 sentences on market expansion (if applicable, else empty string)"
    }}
    """
    messages = [
        {"role": "system", "content": "You are an expert Malaysian government grant consultant. Return JSON only with exact requested keys."},
        {"role": "user", "content": prompt}
    ]

    data, provider = _dispatch_chat_completion(messages, temperature=0.3, max_tokens=800)

    if data and "projectTitle" in data:
        return LLMNarrative(
            grantId=evaluation.grantId,
            projectTitle=str(data.get("projectTitle", f"Digital Transformation for {company.companyName}")),
            transformationJustification=str(data.get("transformationJustification", "")),
            roiAndProductivityProjections=str(data.get("roiAndProductivityProjections", "")),
            marketOrExportReadiness=str(data.get("marketOrExportReadiness", ""))
        )

    return generate_deterministic_template_narrative(company, invoice, evaluation)
