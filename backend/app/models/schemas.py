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

class GrantStackingSummary(BaseModel):
    totalInvoiceAmountMYR: float
    totalClaimableAmountMYR: float
    effectiveSubsidyPercentage: float
    participatingAgencies: List[str] = Field(default_factory=list)
    stackingStrategy: str

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
    stackingSummary: Optional[GrantStackingSummary] = None

class ClaimEvaluationRequest(BaseModel):
    company: SMEProfile
    invoice: Invoice

class DemoScenario(BaseModel):
    id: str
    title: str
    description: str
    expectedGrant: str
    company: SMEProfile
    invoice: Invoice

class RawInvoiceParseRequest(BaseModel):
    rawText: str
    vendorNameHint: Optional[str] = None

class DossierExportResponse(BaseModel):
    claimId: str
    generatedAt: str = ""
    verificationHash: str
    dossierHtml: str

class OrganizationAccount(BaseModel):
    id: str
    email: str
    company: SMEProfile
    defaultInvoice: Optional[Invoice] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None

class OrganizationRegisterRequest(BaseModel):
    email: str
    password: str
    company: SMEProfile

class OrganizationLoginRequest(BaseModel):
    email: str
    password: str

class ApplicationMode(str, Enum):
    ROLLING = "ROLLING"    # Applications accepted year-round until allocation is exhausted
    WINDOWED = "WINDOWED"  # Applications accepted only between opensAt and closesAt

class WindowStatus(str, Enum):
    OPEN = "OPEN"
    CLOSING_SOON = "CLOSING_SOON"
    UPCOMING = "UPCOMING"
    CLOSED = "CLOSED"

class GrantSchemeMetadata(BaseModel):
    grantId: str
    grantName: str
    agency: str
    matchingPercentage: int
    maxCoFundingMYR: float
    sourceUrl: str
    criteriaSummary: str
    isActive: bool = True
    lastCrawledAt: str
    applicationMode: ApplicationMode = ApplicationMode.ROLLING
    opensAt: Optional[str] = None   # YYYY-MM-DD, WINDOWED schemes only
    closesAt: Optional[str] = None  # YYYY-MM-DD, WINDOWED schemes only
    requiresPreApproval: bool = False
    eligibleCategories: List[InvoiceItemCategory] = Field(default_factory=list)

class ProfileGrantMatch(BaseModel):
    """Year-round, invoice-free eligibility of an SME profile against one scheme."""
    grantId: str
    grantName: str
    agency: str
    matchingPercentage: int
    maxCoFundingMYR: float
    isProfileEligible: bool
    profileChecks: List[RuleCheckResult] = Field(default_factory=list)
    eligibleCategories: List[InvoiceItemCategory] = Field(default_factory=list)
    applicationMode: ApplicationMode
    windowStatus: WindowStatus
    opensAt: Optional[str] = None
    closesAt: Optional[str] = None
    daysUntilClose: Optional[int] = None
    daysUntilOpen: Optional[int] = None
    requiresPreApproval: bool = False
    nextStep: str
    sourceUrl: str
    requiredDocuments: List[str] = Field(default_factory=list)

class OpportunityScanResponse(BaseModel):
    orgId: str
    scannedAt: str
    triggerSource: str
    matches: List[ProfileGrantMatch] = Field(default_factory=list)
    eligibleCount: int
    openNowCount: int
    potentialCoFundingMYR: float  # Sum of scheme caps for eligible schemes accepting applications now

class TriggerEventRecord(BaseModel):
    id: str
    orgId: str
    triggerType: str
    title: str
    description: str
    grantsEvaluated: int
    grantsMatched: int
    createdAt: str

class SubmittedGrantDBRecord(BaseModel):
    id: str
    orgId: Optional[str] = "org-nusantara"
    claimId: str
    grantId: str
    grantName: str
    agency: str
    claimableAmountMYR: float
    matchingPercentage: int
    invoiceNumber: str
    vendorName: str
    submittedAt: str
    claimSnapshot: ClaimsReadinessPackage

class CrawlTriggerResponse(BaseModel):
    syncedCount: int
    newlyDiscoveredCount: int
    schemes: List[GrantSchemeMetadata] = Field(default_factory=list)
    triggerEvent: TriggerEventRecord
    updatedClaim: Optional[ClaimsReadinessPackage] = None
    opportunities: Optional[OpportunityScanResponse] = None

class ScheduledScanResponse(BaseModel):
    scannedAt: str
    organizationsScanned: int
    scans: List[OpportunityScanResponse] = Field(default_factory=list)
