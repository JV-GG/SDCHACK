import fixtures from "./backendFixtures.json";
import type {
  ClaimEvaluationRequest,
  ClaimsReadinessPackage,
  DemoScenario,
  GrantEvaluation,
} from "@/types/claim";

/**
 * Mock data for "Mock demonstration mode".
 *
 * backendFixtures.json is not hand-written: it is the backend's own output. Each entry holds a
 * scenario from GET /api/v1/scenarios and the package that POST /api/v1/claims/evaluate returned
 * for it. Rules, amounts and gap advice come from the deterministic engine, so mock mode and live
 * mode agree. The narratives are LLM drafts captured on 2026-10-22; a live run drafts new ones.
 *
 * To refresh after the backend changes its rules or scenarios, see scripts/refresh-fixtures.md.
 */
interface Fixture {
  scenario: DemoScenario;
  claim: ClaimsReadinessPackage;
}

const FIXTURES = fixtures as unknown as Fixture[];

export type ScenarioId = string;

/** Programme caps, shown as captions on grants that did not match (the engine then reports RM 0). */
export const GRANT_PROGRAMME: Record<GrantEvaluation["grantId"], { capMYR: number; capNote: string }> = {
  MDEC_MSME_DIGITAL: { capMYR: 5000, capNote: "per application" },
  SME_CORP_SAG: { capMYR: 1000000, capNote: "per application" },
  MATRADE_MDG: { capMYR: 300000, capNote: "lifetime" },
};

export interface Scenario {
  id: ScenarioId;
  /** Short label, e.g. "Retail SME: LHDN e-Invoicing (MDEC)" */
  label: string;
  /** One line from the backend's description */
  sublabel: string;
  /** What the backend expects the outcome to be */
  expected: string;
  action: string;
  request: ClaimEvaluationRequest;
  claim: ClaimsReadinessPackage;
}

/** "Scenario 1: Retail SME • LHDN e-Invoicing Compliance (MDEC)" -> "Retail SME: LHDN e-Invoicing Compliance (MDEC)" */
function shortTitle(title: string): string {
  return title.replace(/^Scenario \d+:\s*/, "").replace(/\s*•\s*/, ": ");
}

function firstSentence(text: string): string {
  const m = text.match(/^.*?[.!?](\s|$)/);
  return (m ? m[0] : text).trim();
}

export const SCENARIO_LIST: Scenario[] = FIXTURES.map(({ scenario, claim }) => ({
  id: scenario.id,
  label: shortTitle(scenario.title),
  sublabel: firstSentence(scenario.description),
  expected: scenario.expectedGrant,
  action: `Ingest invoice ${scenario.invoice.invoiceNumber}`,
  request: { company: scenario.company, invoice: scenario.invoice },
  claim,
}));

export const SCENARIOS: Record<ScenarioId, Scenario> = Object.fromEntries(SCENARIO_LIST.map((s) => [s.id, s]));

export const DEFAULT_SCENARIO: ScenarioId = SCENARIO_LIST[0].id;

/** The default claim on screen (scenario 1). Name kept from the plan. */
export const MOCK_CLAIM_PACKAGE: ClaimsReadinessPackage = SCENARIO_LIST[0].claim;

// Figures that must agree. A failure shows up in the console while developing.
for (const s of SCENARIO_LIST) {
  const c = s.claim;
  const lineSum = c.invoice.items.reduce((sum, i) => sum + i.totalPriceMYR, 0);
  console.assert(lineSum === c.invoice.totalAmountMYR, `${s.id}: invoice lines do not sum to the total`);
  const claimable = c.evaluations.filter((e) => e.isEligible).reduce((sum, e) => sum + e.maxCoFundingMYR, 0);
  console.assert(claimable === c.totalClaimableAmountMYR, `${s.id}: eligible grants do not sum to the claimable total`);
}
