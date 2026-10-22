import type { GrantEvaluation } from "@/types/claim";

/**
 * Programme reference metadata used for captions when an agency grant does not match
 * or reports a default baseline cap.
 */
export const GRANT_PROGRAMME: Record<GrantEvaluation["grantId"], { capMYR: number; capNote: string }> = {
  MDEC_MSME_DIGITAL: { capMYR: 5000, capNote: "per application" },
  SME_CORP_SAG: { capMYR: 1000000, capNote: "per application" },
  MATRADE_MDG: { capMYR: 300000, capNote: "lifetime ceiling" },
  HRD_CORP_SBL: { capMYR: 25000, capNote: "per SBL-Khas training claim" },
  MIDA_DISF: { capMYR: 500000, capNote: "strategic automation cap" },
  MITI_INDUSTRY4WRD: { capMYR: 500000, capNote: "70:30 intervention cap" },
  CRADLE_CIP_SPARK: { capMYR: 150000, capNote: "early-stage tech commercialisation" },
};
