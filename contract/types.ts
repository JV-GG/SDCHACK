/**
 * Shared Data Contract between Backend (FastAPI) and Frontend (Next.js)
 * SDCHACK 2026 - Problem Statement #9 (Autonomous SME Grant Copilot & Claim Engine)
 */

export type SectorType = 'SERVICES' | 'MANUFACTURING';

export interface SMEProfile {
  companyName: string;
  registrationNumber: string; // SSM BizProfile
  incorporationDate: string;  // YYYY-MM-DD
  tenureMonths: number;
  malaysianEquityPercentage: number; // e.g. 65 for 65%
  annualTurnoverMYR: number;
  fullTimeEmployees: number; // FTE from Orbyte HR
  sector: SectorType;
  isGlcOrMncOwned: boolean;
  isActiveExporter: boolean;
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  category: 'DIGITAL_ERP' | 'HR_PAYROLL' | 'E_INVOICING' | 'AUTOMATION_HARDWARE' | 'EXPORT_EXHIBITION' | 'OTHER';
  quantity: number;
  unitPriceMYR: number;
  totalPriceMYR: number;
}

export interface Invoice {
  invoiceNumber: string;
  invoiceDate: string;
  vendorName: string;
  vendorIsMdecTsp: boolean; // Technology Solution Provider whitelist check
  totalAmountMYR: number;
  items: InvoiceLineItem[];
}

export interface RuleCheckResult {
  ruleName: string;
  passed: boolean;
  requirement: string;
  actual: string;
  reason?: string;
  gapAdvice?: string; // Proactive advisory recommendation on how to qualify
}

export interface GrantEvaluation {
  grantId:
    | 'MDEC_MSME_DIGITAL'
    | 'SME_CORP_SAG'
    | 'MATRADE_MDG'
    | 'HRD_CORP_SBL'
    | 'MIDA_DISF'
    | 'MITI_INDUSTRY4WRD'
    | 'CRADLE_CIP_SPARK'
    | string;
  grantName: string;
  agency: 'MDEC' | 'SME Corp' | 'MATRADE' | 'HRD Corp' | 'MIDA' | 'MITI' | 'Cradle Fund' | string;
  isEligible: boolean;
  maxCoFundingMYR: number;
  matchingPercentage: number; // e.g. 50 for 50%
  checks: RuleCheckResult[];
  requiredDocuments: string[];
}

export interface LLMNarrative {
  grantId: string;
  projectTitle: string;
  transformationJustification: string;
  roiAndProductivityProjections: string;
  marketOrExportReadiness?: string;
}

export interface GrantStackingSummary {
  totalInvoiceAmountMYR: number;
  totalClaimableAmountMYR: number;
  effectiveSubsidyPercentage: number;
  participatingAgencies: string[];
  stackingStrategy: string;
}

export interface AuditEntry {
  action: string;
  timestamp: string;
  performedBy: string;
  eventType?: string | null;
  ipAddress?: string | null;
}

export interface ClaimsReadinessPackage {
  claimId: string;
  timestamp: string;
  company: SMEProfile;
  invoice: Invoice;
  evaluations: GrantEvaluation[];
  narratives: LLMNarrative[];
  totalClaimableAmountMYR: number;
  status: 'EVALUATED' | 'APPROVED' | 'SUBMITTED';
  auditTrail: AuditEntry[];
  stackingSummary?: GrantStackingSummary;
}

export type DocumentKind = 'INVOICE' | 'QUOTATION' | 'RECEIPT';

/** How the document entered the system, so the audit trail credits the right actor. */
export type DocumentSource = 'PRESET' | 'UPLOAD' | 'OCR_TEXT' | 'MANUAL' | 'STORED';

export interface ClaimEvaluationRequest {
  company: SMEProfile;
  invoice: Invoice;
  documentKind?: DocumentKind;
  documentSource?: DocumentSource | null;
  /** Programme the user applied for from the year-round list, if any. */
  targetGrantId?: string | null;
}

export interface DemoScenario {
  id: string;
  title: string;
  description: string;
  expectedGrant: string;
  company: SMEProfile;
  invoice: Invoice;
}

export interface RawInvoiceParseRequest {
  rawText: string;
  vendorNameHint?: string;
}

export interface DossierExportResponse {
  claimId: string;
  generatedAt: string;
  verificationHash: string;
  dossierHtml: string;
}

export interface OrganizationAccount {
  id: string;
  email: string;
  company: SMEProfile;
  defaultInvoice?: Invoice;
  createdAt?: string;
  updatedAt?: string;
}

export interface OrganizationRegisterRequest {
  email: string;
  password: string;
  company: SMEProfile;
}

export interface OrganizationLoginRequest {
  email: string;
  password: string;
}

export type InvoiceItemCategory = InvoiceLineItem['category'];

/** ROLLING: accepted year-round until allocation runs out. WINDOWED: only between opensAt and closesAt. */
export type ApplicationMode = 'ROLLING' | 'WINDOWED';

export type WindowStatus = 'OPEN' | 'CLOSING_SOON' | 'UPCOMING' | 'CLOSED';

export interface GrantSchemeMetadata {
  grantId: string;
  grantName: string;
  agency: string;
  matchingPercentage: number;
  maxCoFundingMYR: number;
  sourceUrl: string;
  criteriaSummary: string;
  isActive: boolean;
  lastCrawledAt: string;
  applicationMode: ApplicationMode;
  opensAt?: string | null;  // YYYY-MM-DD, WINDOWED schemes only
  closesAt?: string | null; // YYYY-MM-DD, WINDOWED schemes only
  requiresPreApproval: boolean;
  eligibleCategories: InvoiceItemCategory[];
}

/** Year-round, invoice-free eligibility of an SME profile against one scheme. */
export interface ProfileGrantMatch {
  grantId: GrantEvaluation['grantId'];
  grantName: string;
  agency: GrantEvaluation['agency'];
  matchingPercentage: number;
  maxCoFundingMYR: number;
  isProfileEligible: boolean;
  profileChecks: RuleCheckResult[];
  eligibleCategories: InvoiceItemCategory[];
  applicationMode: ApplicationMode;
  windowStatus: WindowStatus;
  opensAt?: string | null;
  closesAt?: string | null;
  daysUntilClose?: number | null;
  daysUntilOpen?: number | null;
  requiresPreApproval: boolean;
  nextStep: string;
  sourceUrl: string;
  requiredDocuments: string[];
}

export interface OpportunityScanResponse {
  orgId: string;
  scannedAt: string;
  triggerSource: string;
  matches: ProfileGrantMatch[];
  eligibleCount: number;
  openNowCount: number;
  /** Sum of scheme caps for eligible schemes accepting applications now. */
  potentialCoFundingMYR: number;
}

export interface ScheduledScanResponse {
  scannedAt: string;
  organizationsScanned: number;
  scans: OpportunityScanResponse[];
}

export type AuditCategory = 'AUTH' | 'PROFILE' | 'DOCUMENT' | 'EVALUATION' | 'APPROVAL' | 'SUBMISSION' | 'DISCOVERY';

/** One append-only, hash-chained organization activity record written by the backend. */
export interface AuditEventRecord {
  id: string;
  orgId: string;
  claimId?: string | null;
  eventType: string;
  category: AuditCategory | string;
  title: string;
  description: string;
  actorType: 'USER' | 'SYSTEM' | 'AI' | string;
  actorEmail?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
  prevHash: string;
  entryHash: string;
}

export interface OrgAuditLogResponse {
  orgId: string;
  /** Newest first. */
  events: AuditEventRecord[];
  totalEvents: number;
  /** True when every entry's hash matches its content and links to the previous entry. */
  chainValid: boolean;
}

export interface SessionEventRequest {
  orgId: string;
  reason: 'RESUME' | 'SWITCH';
}

export interface ClaimSubmitRequest {
  /** Omit to submit every eligible grant not yet submitted. */
  grantIds?: string[] | null;
  verificationHash?: string | null;
}

export interface ClaimSubmitResponse {
  claim: ClaimsReadinessPackage;
  records: SubmittedGrantDBRecord[];
}

export interface TriggerEventRecord {
  id: string;
  orgId: string;
  triggerType:
    | 'NEW_INVOICE_SUBMITTED'
    | 'PERIODIC_GRANT_CRAWL'
    | 'NEW_GRANT_DISCOVERED'
    | 'ORG_PROFILE_UPDATED'
    | 'PROFILE_OPPORTUNITY_SCAN'
    | 'SCHEDULED_OPPORTUNITY_SCAN'
    | string;
  title: string;
  description: string;
  grantsEvaluated: number;
  grantsMatched: number;
  createdAt: string;
}

export interface SubmittedGrantDBRecord {
  id: string;
  orgId?: string;
  claimId: string;
  grantId: string;
  grantName: string;
  agency: string;
  claimableAmountMYR: number;
  matchingPercentage: number;
  invoiceNumber: string;
  vendorName: string;
  submittedAt: string;
  claimSnapshot: ClaimsReadinessPackage;
}

export interface CrawlTriggerResponse {
  syncedCount: number;
  newlyDiscoveredCount: number;
  schemes: GrantSchemeMetadata[];
  triggerEvent: TriggerEventRecord;
  updatedClaim?: ClaimsReadinessPackage;
  opportunities?: OpportunityScanResponse;
}
