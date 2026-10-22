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
}

export interface GrantEvaluation {
  grantId: 'MDEC_MSME_DIGITAL' | 'SME_CORP_SAG' | 'MATRADE_MDG';
  grantName: string;
  agency: 'MDEC' | 'SME Corp' | 'MATRADE';
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

export interface ClaimsReadinessPackage {
  claimId: string;
  timestamp: string;
  company: SMEProfile;
  invoice: Invoice;
  evaluations: GrantEvaluation[];
  narratives: LLMNarrative[];
  totalClaimableAmountMYR: number;
  status: 'EVALUATED' | 'APPROVED' | 'SUBMITTED';
  auditTrail: {
    action: string;
    timestamp: string;
    performedBy: string;
  }[];
}

export interface ClaimEvaluationRequest {
  company: SMEProfile;
  invoice: Invoice;
}
