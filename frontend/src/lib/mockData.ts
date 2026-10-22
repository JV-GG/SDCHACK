import mockPackage from "../../../contract/mock_claim_package.json";
import type {
  ClaimEvaluationRequest,
  ClaimsReadinessPackage,
  GrantEvaluation,
  Invoice,
  LLMNarrative,
  SMEProfile,
} from "@/types/claim";

/**
 * The contract fixture holds MDEC (eligible) and SME Corp (not eligible) only.
 * The Grant Hub shows all three agencies, so the frontend adds a MATRADE evaluation and a second
 * scenario here. contract/ is read-only for Member 1; nothing below changes it.
 */
const FIXTURE = mockPackage as unknown as ClaimsReadinessPackage;

export type ScenarioId = "A" | "B";

/** Programme facts used for captions when the engine reports a 0 cap on a grant that did not match. */
export const GRANT_PROGRAMME: Record<GrantEvaluation["grantId"], { capMYR: number; capNote: string }> = {
  MDEC_MSME_DIGITAL: { capMYR: 5000, capNote: "per application" },
  SME_CORP_SAG: { capMYR: 100000, capNote: "per application (sample cap)" },
  MATRADE_MDG: { capMYR: 300000, capNote: "lifetime" },
};

const MATRADE_NOT_MET_A: GrantEvaluation = {
  grantId: "MATRADE_MDG",
  grantName: "Market Development Grant (MDG)",
  agency: "MATRADE",
  isEligible: false,
  maxCoFundingMYR: 0,
  matchingPercentage: 50,
  checks: [
    {
      ruleName: "Malaysian Equity Ownership",
      passed: true,
      requirement: "≥ 60% Malaysian ownership",
      actual: "85.0% Malaysian-owned via SSM",
      reason: "Meets MATRADE equity threshold.",
    },
    {
      ruleName: "Operational Tenure",
      passed: true,
      requirement: "≥ 12 months active operation",
      actual: "42 months in business",
      reason: "Incorporated on 2021-04-15.",
    },
    {
      ruleName: "Active Exporter",
      passed: false,
      requirement: "Active exporter of Made-in-Malaysia goods or services",
      actual: "No export revenue declared",
      reason: "MDG supports firms that already export or are export-ready.",
    },
    {
      ruleName: "Export Expenditure Scope",
      passed: false,
      requirement: "Trade fair, B2B mission or export marketing invoice",
      actual: "Software / e-Invoicing only",
      reason: "This invoice does not contain export promotion spend.",
    },
  ],
  requiredDocuments: [],
};

/** Scenario A: CloudTech e-Invoicing (MDEC TSP). The contract fixture plus a MATRADE evaluation. */
export const MOCK_CLAIM_PACKAGE_A: ClaimsReadinessPackage = {
  ...FIXTURE,
  evaluations: [...FIXTURE.evaluations, MATRADE_NOT_MET_A],
};

/** Back-compat export used by the original scaffold and by the plan (`MOCK_CLAIM_PACKAGE`). */
export const MOCK_CLAIM_PACKAGE: ClaimsReadinessPackage = MOCK_CLAIM_PACKAGE_A;

const INVOICE_B: Invoice = {
  invoiceNumber: "INV-SAG-3317",
  invoiceDate: "2026-10-20",
  vendorName: "Sinar Automasi Sdn Bhd",
  vendorIsMdecTsp: false,
  totalAmountMYR: 48000,
  items: [
    {
      id: "item-1",
      description: "Two-lane parcel sortation conveyor with barcode scanners",
      category: "AUTOMATION_HARDWARE",
      quantity: 1,
      unitPriceMYR: 36000,
      totalPriceMYR: 36000,
    },
    {
      id: "item-2",
      description: "Warehouse control software integration and commissioning",
      category: "AUTOMATION_HARDWARE",
      quantity: 1,
      unitPriceMYR: 12000,
      totalPriceMYR: 12000,
    },
  ],
};

const SAG_ELIGIBLE_B: GrantEvaluation = {
  grantId: "SME_CORP_SAG",
  grantName: "Smart Automation Grant (SAG)",
  agency: "SME Corp",
  isEligible: true,
  maxCoFundingMYR: GRANT_PROGRAMME.SME_CORP_SAG.capMYR,
  matchingPercentage: 50,
  checks: [
    {
      ruleName: "Malaysian Equity Ownership",
      passed: true,
      requirement: "≥ 51% Malaysian ownership",
      actual: "85.0% Malaysian-owned via SSM",
      reason: "Meets SME Corp equity threshold.",
    },
    {
      ruleName: "Operational Tenure",
      passed: true,
      requirement: "≥ 12 months active operation",
      actual: "42 months in business",
      reason: "Incorporated on 2021-04-15.",
    },
    {
      ruleName: "SME Size Classification",
      passed: true,
      requirement: "Services: ≤ 75 full-time employees",
      actual: "8 FTEs via Orbyte HR",
      reason: "Within the SME Corp services cap.",
    },
    {
      ruleName: "GLC / MNC Ownership",
      passed: true,
      requirement: "< 20% GLC or MNC ownership",
      actual: "No GLC or MNC shareholding on SSM",
      reason: "Not government-linked or multinational owned.",
    },
    {
      ruleName: "Automation Expenditure Scope",
      passed: true,
      requirement: "Industrial hardware or smart automation workflow equipment",
      actual: "Sortation conveyor and scanners (RM 36,000.00)",
      reason: "Capital equipment qualifies under SAG.",
    },
  ],
  requiredDocuments: [
    "SSM BizProfile Form (e-Info)",
    "Latest 2-Month Bank Account Statements",
    "Vendor Quotation and Tax Invoice for automation equipment",
    "Pre / post man-hour reduction justification",
    "Signed Grant Declaration Letter",
  ],
};

const MDEC_NOT_MET_B: GrantEvaluation = {
  grantId: "MDEC_MSME_DIGITAL",
  grantName: "MSME Digital Grant MADANI (SME Digitalisation Grant)",
  agency: "MDEC",
  isEligible: false,
  maxCoFundingMYR: 0,
  matchingPercentage: 50,
  checks: [
    {
      ruleName: "Malaysian Equity Ownership",
      passed: true,
      requirement: "≥ 60% Malaysian ownership",
      actual: "85.0% Malaysian-owned via SSM",
      reason: "Meets MDEC statutory equity threshold.",
    },
    {
      ruleName: "Annual Sales Turnover",
      passed: true,
      requirement: "Min RM 50,000 annual sales",
      actual: "RM 480,000.00 declared turnover",
      reason: "Exceeds minimum turnover requirement.",
    },
    {
      ruleName: "Approved Technology Solution Provider (TSP)",
      passed: false,
      requirement: "Vendor must be an accredited MDEC TSP",
      actual: "Sinar Automasi Sdn Bhd (not on the TSP registry)",
      reason: "The vendor is not an MDEC-approved provider.",
    },
    {
      ruleName: "Digital Expenditure Category",
      passed: false,
      requirement: "e-Invoicing, ERP, HR/payroll, CRM, e-commerce or cybersecurity",
      actual: "Automation hardware only",
      reason: "Industrial equipment is outside the digitalisation scope.",
    },
  ],
  requiredDocuments: [],
};

const MATRADE_NOT_MET_B: GrantEvaluation = {
  ...MATRADE_NOT_MET_A,
  checks: MATRADE_NOT_MET_A.checks.map((c) =>
    c.ruleName === "Export Expenditure Scope"
      ? { ...c, actual: "Automation hardware only", reason: "This invoice does not contain export promotion spend." }
      : c,
  ),
};

const NARRATIVE_B: LLMNarrative = {
  grantId: "SME_CORP_SAG",
  projectTitle: "Automated Parcel Sortation Line for Multi-Outlet Retail Fulfilment",
  transformationJustification:
    "Nusantara Retail Solutions fulfils about 1,200 online and outlet orders each month and sorts every parcel by hand at one packing table. Manual sorting causes mis-routed parcels and a two-person bottleneck at the end of each day. A two-lane conveyor with barcode scanners, connected to the existing inventory system, moves sorting onto equipment and keeps staff on packing and customer service.",
  roiAndProductivityProjections:
    "Estimated reduction of about 70 man-hours per month in manual sorting, from roughly 110 to 40. Mis-routed parcels are expected to fall by about 60% within the first quarter. Payback on the RM 48,000.00 investment is projected at under 24 months after the 50% matching contribution.",
};

const COMPANY: SMEProfile = FIXTURE.company;

export const SCENARIO_B_REQUEST: ClaimEvaluationRequest = { company: COMPANY, invoice: INVOICE_B };
export const SCENARIO_A_REQUEST: ClaimEvaluationRequest = { company: COMPANY, invoice: FIXTURE.invoice };

/** Scenario B: SME Corp automation machinery. */
export const MOCK_CLAIM_PACKAGE_B: ClaimsReadinessPackage = {
  claimId: "CLM-2026-SAG-091",
  timestamp: "2026-10-22T09:10:00Z",
  company: COMPANY,
  invoice: INVOICE_B,
  evaluations: [MDEC_NOT_MET_B, SAG_ELIGIBLE_B, MATRADE_NOT_MET_B],
  narratives: [NARRATIVE_B],
  // 50% of RM 48,000.00 = RM 24,000.00, under the RM 100,000.00 cap.
  totalClaimableAmountMYR: 24000,
  status: "EVALUATED",
  auditTrail: [
    {
      action: "Expense Trigger Detected (Invoice #INV-SAG-3317)",
      timestamp: "2026-10-22T09:10:00Z",
      performedBy: "Accounting Ingestion Webhook",
    },
    {
      action: "Deterministic Rules Engine Verification Completed",
      timestamp: "2026-10-22T09:10:02Z",
      performedBy: "RulesEngine::SME_CORP_SAG",
    },
    {
      action: "LLM Justification Narrative Drafted",
      timestamp: "2026-10-22T09:10:05Z",
      performedBy: "Gemini-Flash-ClaimNarrator",
    },
  ],
};

export interface Scenario {
  id: ScenarioId;
  label: string;
  sublabel: string;
  action: string;
  request: ClaimEvaluationRequest;
  claim: ClaimsReadinessPackage;
}

export const SCENARIOS: Record<ScenarioId, Scenario> = {
  A: {
    id: "A",
    label: "MDEC e-Invoicing",
    sublabel: "CloudTech Malaysia, MDEC TSP",
    action: "Ingest invoice: CloudTech e-Invoicing (MDEC TSP)",
    request: SCENARIO_A_REQUEST,
    claim: MOCK_CLAIM_PACKAGE_A,
  },
  B: {
    id: "B",
    label: "SME Corp automation machinery",
    sublabel: "Sinar Automasi, sortation line",
    action: "Ingest invoice: Sinar Automasi sortation line (SAG)",
    request: SCENARIO_B_REQUEST,
    claim: MOCK_CLAIM_PACKAGE_B,
  },
};

// Figures that must agree. A failure shows up in the console while developing.
for (const s of Object.values(SCENARIOS)) {
  const lineSum = s.claim.invoice.items.reduce((sum, i) => sum + i.totalPriceMYR, 0);
  console.assert(lineSum === s.claim.invoice.totalAmountMYR, `${s.claim.claimId}: invoice lines do not sum to the total`);
  const eligible = s.claim.evaluations.filter((e) => e.isEligible);
  const claimable = eligible.reduce(
    (sum, e) => sum + Math.min((s.claim.invoice.totalAmountMYR * e.matchingPercentage) / 100, e.maxCoFundingMYR),
    0,
  );
  console.assert(claimable === s.claim.totalClaimableAmountMYR, `${s.claim.claimId}: claimable does not match the rules`);
}
