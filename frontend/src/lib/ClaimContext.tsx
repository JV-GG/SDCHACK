"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { ClaimsReadinessPackage, GrantEvaluation, LLMNarrative } from "@/types/claim";
import { SCENARIOS } from "@/lib/mockData";
import type { ScenarioId } from "@/lib/mockData";
import { approveClaim, evaluateClaim } from "@/lib/api";
import type { ApiSource } from "@/lib/api";
import { formatMYR } from "@/lib/format";

export type Mode = "mock" | "live";

/** The five steps of the journey, in order. */
export const JOURNEY_STEPS = ["Trigger", "Connected data", "Rules and AI", "Human approval", "Outcome"] as const;

/** Steps 0-2 are run by the pipeline when an invoice is ingested; 3 and 4 wait on people. */
const PIPELINE_STEP_MS = 650;

interface ClaimContextValue {
  claim: ClaimsReadinessPackage;
  scenario: ScenarioId;
  mode: Mode;
  /** Where the claim on screen came from. */
  source: ApiSource;
  /** One quiet sentence when live mode fell back to mock data. */
  notice: string | null;
  pipeline: { running: boolean; step: number };
  setMode: (mode: Mode) => void;
  selectScenario: (id: ScenarioId) => void;
  ingest: () => void;
  approve: (narratives: LLMNarrative[], edited: boolean) => Promise<void>;
  markSubmitted: () => void;
}

const ClaimContext = createContext<ClaimContextValue | null>(null);

export function useClaim(): ClaimContextValue {
  const ctx = useContext(ClaimContext);
  if (!ctx) throw new Error("useClaim must be used inside <ClaimProvider>");
  return ctx;
}

/** Eligible evaluations, in the order the engine returned them. */
export function eligibleGrants(claim: ClaimsReadinessPackage): GrantEvaluation[] {
  return claim.evaluations.filter((e) => e.isEligible);
}

/** Co-funding for one grant: the matching share of the invoice, held to the grant's cap. */
export function coFunding(claim: ClaimsReadinessPackage, grant: GrantEvaluation) {
  const matched = (claim.invoice.totalAmountMYR * grant.matchingPercentage) / 100;
  const claimable = Math.min(matched, grant.maxCoFundingMYR);
  return { matched, claimable, capped: matched > grant.maxCoFundingMYR };
}

export function ClaimProvider({ children }: { children: ReactNode }) {
  const [scenario, setScenario] = useState<ScenarioId>("A");
  const [claim, setClaim] = useState<ClaimsReadinessPackage>(SCENARIOS.A.claim);
  const [mode, setModeState] = useState<Mode>("mock");
  const [source, setSource] = useState<ApiSource>("mock");
  const [notice, setNotice] = useState<string | null>(null);
  const [pipeline, setPipeline] = useState({ running: false, step: 0 });

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runId = useRef(0);

  const clearTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  /** Load a scenario's claim: from the backend in live mode, from the fixture otherwise. */
  const load = useCallback(async (id: ScenarioId, nextMode: Mode) => {
    const scn = SCENARIOS[id];
    if (nextMode === "mock") {
      return { data: scn.claim, source: "mock" as ApiSource, reason: null as string | null };
    }
    const result = await evaluateClaim(scn.request);
    return {
      data: result.data,
      source: result.source,
      reason: result.source === "mock" ? (result.fallbackReason ?? "The backend could not be reached.") : null,
    };
  }, []);

  const apply = useCallback((data: ClaimsReadinessPackage, src: ApiSource, reason: string | null) => {
    setClaim(data);
    setSource(src);
    setNotice(reason ? `${reason} Showing mock data instead.` : null);
  }, []);

  const setMode = useCallback(
    (next: Mode) => {
      setModeState(next);
      const id = ++runId.current;
      clearTimer();
      setPipeline({ running: false, step: 0 });
      void load(scenario, next).then((r) => {
        if (id === runId.current) apply(r.data, r.source, r.reason);
      });
    },
    [apply, clearTimer, load, scenario],
  );

  const selectScenario = useCallback(
    (id: ScenarioId) => {
      if (id === scenario) return;
      setScenario(id);
      // Selecting a scenario only chooses what the next ingestion will carry; the claim on screen
      // changes when the invoice is ingested.
    },
    [scenario],
  );

  const ingest = useCallback(() => {
    const id = ++runId.current;
    clearTimer();
    setPipeline({ running: true, step: 0 });
    setNotice(null);
    const pending = load(scenario, mode);

    const tick = (step: number) => {
      if (id !== runId.current) return;
      if (step < 3) {
        setPipeline({ running: true, step });
        timer.current = setTimeout(() => tick(step + 1), PIPELINE_STEP_MS);
        return;
      }
      void pending.then((r) => {
        if (id !== runId.current) return;
        apply(r.data, r.source, r.reason);
        setPipeline({ running: false, step: 0 });
      });
    };
    tick(0);
  }, [apply, clearTimer, load, mode, scenario]);

  const approve = useCallback(
    async (narratives: LLMNarrative[], edited: boolean) => {
      const now = new Date().toISOString();
      const entries = [] as ClaimsReadinessPackage["auditTrail"];
      if (edited) {
        entries.push({
          action: "AI-drafted narrative edited before sign-off",
          timestamp: now,
          performedBy: "Business Owner Review",
        });
      }
      entries.push({
        action: `Claim ${claim.claimId} approved and signed off for ${formatMYR(claim.totalClaimableAmountMYR)} co-funding`,
        timestamp: now,
        performedBy: "Business Owner Approval",
      });

      const local: ClaimsReadinessPackage = {
        ...claim,
        narratives,
        status: "APPROVED",
        auditTrail: [...claim.auditTrail, ...entries],
      };

      if (mode === "live" && source === "live") {
        const remote = await approveClaim(local);
        if (remote) {
          setClaim({ ...remote, narratives });
          return;
        }
        setNotice("The backend could not record the approval. It is saved on this screen only.");
      }
      setClaim(local);
    },
    [claim, mode, source],
  );

  const markSubmitted = useCallback(() => {
    setClaim((c) => ({
      ...c,
      status: "SUBMITTED",
      auditTrail: [
        ...c.auditTrail,
        {
          action: `Application packet for ${c.claimId} exported for agency submission`,
          timestamp: new Date().toISOString(),
          performedBy: "Business Owner Approval",
        },
      ],
    }));
  }, []);

  const value = useMemo<ClaimContextValue>(
    () => ({ claim, scenario, mode, source, notice, pipeline, setMode, selectScenario, ingest, approve, markSubmitted }),
    [claim, scenario, mode, source, notice, pipeline, setMode, selectScenario, ingest, approve, markSubmitted],
  );

  return <ClaimContext.Provider value={value}>{children}</ClaimContext.Provider>;
}
