import type { ClaimEvaluationRequest, Invoice, SMEProfile } from "@/types/claim";

/**
 * Canonical Malaysian SME Demo Business
 * Nusantara Retail Solutions Sdn Bhd
 * Verified across SSM BizProfile, Orbyte HR, and e-Invoicing accounting records.
 */
export const DEMO_COMPANY: SMEProfile = {
  companyName: "Nusantara Retail Solutions Sdn Bhd",
  registrationNumber: "202101045892 (1426192-A)",
  incorporationDate: "2021-04-15",
  tenureMonths: 42,
  malaysianEquityPercentage: 85.0,
  annualTurnoverMYR: 480000.0,
  fullTimeEmployees: 8,
  sector: "SERVICES",
  isGlcOrMncOwned: false,
  isActiveExporter: false,
};

export const DEMO_INVOICE: Invoice = {
  invoiceNumber: "INV-MDEC-9082",
  invoiceDate: "2026-10-18",
  vendorName: "CloudTech Malaysia Sdn Bhd (MDEC TSP #0421)",
  vendorIsMdecTsp: true,
  totalAmountMYR: 10000.0,
  items: [
    {
      id: "item-1",
      description: "LHDN e-Invoicing Compliance Module & Multi-store POS",
      category: "E_INVOICING",
      quantity: 1,
      unitPriceMYR: 6000.0,
      totalPriceMYR: 6000.0,
    },
    {
      id: "item-2",
      description: "Cloud ERP & Automated Inventory Sync (12-month license)",
      category: "DIGITAL_ERP",
      quantity: 1,
      unitPriceMYR: 4000.0,
      totalPriceMYR: 4000.0,
    },
  ],
};

export const DEMO_CLAIM_REQUEST: ClaimEvaluationRequest = {
  company: DEMO_COMPANY,
  invoice: DEMO_INVOICE,
};
