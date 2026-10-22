import type { GrantEvaluation } from "@/types/claim";

/**
 * Programme reference metadata used for captions when an agency grant does not match
 * or reports a default baseline cap.
 */
export const GRANT_PROGRAMME: Record<GrantEvaluation["grantId"], { capMYR: number; capNote: string }> = {
  MDEC_MSME_DIGITAL: { capMYR: 5000, capNote: "per application" },
  SME_CORP_SAG: { capMYR: 100000, capNote: "per application (sample cap)" },
  MATRADE_MDG: { capMYR: 300000, capNote: "lifetime" },
};
