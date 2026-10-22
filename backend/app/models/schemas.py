from datetime import date
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field

class SectorType(str, Enum):
    SERVICES = "SERVICES"
    MANUFACTURING = "MANUFACTURING"

class InvoiceItemCategory(str, Enum):
    DIGITAL_ERP = "DIGITAL_ERP"
    HR_PAYROLL = "HR_PAYROLL"
    E_INVOICING = "E_INVOICING"
    AUTOMATION_HARDWARE = "AUTOMATION_HARDWARE"
    EXPORT_EXHIBITION = "EXPORT_EXHIBITION"
    OTHER = "OTHER"

class SMEProfile(BaseModel):
    companyName: str
    registrationNumber: str
    incorporationDate: str
    tenureMonths: int
    malaysianEquityPercentage: float
    annualTurnoverMYR: float
    fullTimeEmployees: int
    sector: SectorType
    isGlcOrMncOwned: bool = False
    isActiveExporter: bool = False

class InvoiceLineItem(BaseModel):
    id: str
    description: str
    category: InvoiceItemCategory
    quantity: int = 1
    unitPriceMYR: float
    totalPriceMYR: float

class Invoice(BaseModel):
    invoiceNumber: str
    invoiceDate: str
    vendorName: str
    vendorIsMdecTsp: bool = False
    totalAmountMYR: float
    items: List[InvoiceLineItem] = Field(default_factory=list)

class RuleCheckResult(BaseModel):
    ruleName: str
    passed: bool
    requirement: str
    actual: str
    reason: Optional[str] = None
    gapAdvice: Optional[str] = None

class GrantEvaluation(BaseModel):
    grantId: str
    grantName: str
    agency: str
    isEligible: bool
    maxCoFundingMYR: float
    matchingPercentage: int
    checks: List[RuleCheckResult] = Field(default_factory=list)
    requiredDocuments: List[str] = Field(default_factory=list)

class LLMNarrative(BaseModel):
    grantId: str
    projectTitle: str
    transformationJustification: str
    roiAndProductivityProjections: str
    marketOrExportReadiness: Optional[str] = None

class AuditEntry(BaseModel):
    action: str
    timestamp: str
    performedBy: str

class ClaimsReadinessPackage(BaseModel):
    claimId: str
    timestamp: str
    company: SMEProfile
    invoice: Invoice
    evaluations: List[GrantEvaluation]
    narratives: List[LLMNarrative] = Field(default_factory=list)
    totalClaimableAmountMYR: float
    status: str = "EVALUATED"
    auditTrail: List[AuditEntry] = Field(default_factory=list)

class ClaimEvaluationRequest(BaseModel):
    company: SMEProfile
    invoice: Invoice
