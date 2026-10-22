"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  ClaimsReadinessPackage,
  GrantEvaluation,
  Invoice,
  LLMNarrative,
  SMEProfile,
} from "@/types/claim";
import { approveClaim, checkBackendHealth, evaluateClaim } from "@/lib/api";
import { DEMO_CLAIM_REQUEST, DEMO_COMPANY, DEMO_INVOICE } from "@/lib/scenarios";
import { formatMYR } from "@/lib/format";

export const JOURNEY_STEPS = [
  "Trigger",
  "Connected data",
  "Rules and AI",
  "Human approval",
  "Outcome",
] as const;

const PIPELINE_STEP_MS = 600;

interface ClaimContextValue {
  claim: ClaimsReadinessPackage | null;
  company: SMEProfile;
  invoice: Invoice;
  loading: boolean;
  error: string | null;
  isConnected: boolean;
  notice: string | null;
  pipeline: { running: boolean; step: number };
  reEvaluate: () => Promise<void>;
  approve: (narratives: LLMNarrative[], edited: boolean) => Promise<void>;
  markSubmitted: () => void;
  retry: () => Promise<void>;
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
  const [claim, setClaim] = useState<ClaimsReadinessPackage | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [pipeline, setPipeline] = useState({ running: false, step: 0 });

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runId = useRef(0);

  const clearTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  /** Evaluate the demo SME live against the FastAPI backend */
  const runEvaluation = useCallback(
    async (showPipeline = false) => {
      const currentRun = ++runId.current;
      clearTimer();
      setLoading(true);
      setError(null);

      if (showPipeline) {
        setPipeline({ running: true, step: 0 });
        const tick = (step: number) => {
          if (currentRun !== runId.current) return;
          if (step < 3) {
            setPipeline({ running: true, step });
            timer.current = setTimeout(() => tick(step + 1), PIPELINE_STEP_MS);
          }
        };
        tick(0);
      }

      try {
        const result = await evaluateClaim(DEMO_CLAIM_REQUEST);

        if (currentRun === runId.current) {
          setClaim(result);
          setIsConnected(true);
          setError(null);
        }
      } catch (err) {
        if (currentRun === runId.current) {
          const msg = err instanceof Error ? err.message : "Failed to evaluate claim on live backend.";
          setError(msg);
          setIsConnected(false);
        }
      } finally {
        if (currentRun === runId.current) {
          setLoading(false);
          setPipeline({ running: false, step: 0 });
        }
      }
    },
    [clearTimer],
  );

  /** Initial load: check health & run live evaluation for the demo SME */
  const initialize = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const health = await checkBackendHealth();
      if (!health.ok) {
        setIsConnected(false);
        setError("Backend is offline. Ensure FastAPI is running on port 8000.");
        setLoading(false);
        return;
      }
      setIsConnected(true);
      await runEvaluation(false);
    } catch (err) {
      setIsConnected(false);
      setError(err instanceof Error ? err.message : "Connection failed");
      setLoading(false);
    }
  }, [runEvaluation]);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  const reEvaluate = useCallback(async () => {
    await runEvaluation(true);
  }, [runEvaluation]);

  const approve = useCallback(
    async (narratives: LLMNarrative[], edited: boolean) => {
      if (!claim) return;
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

      try {
        const remote = await approveClaim(local);
        setClaim(remote);
        setNotice(null);
      } catch (err) {
        setClaim(local);
        setNotice("Saved locally. Could not sync approval to backend.");
      }
    },
    [claim],
  );

  const markSubmitted = useCallback(() => {
    if (!claim) return;
    setClaim({
      ...claim,
      status: "SUBMITTED",
      auditTrail: [
        ...claim.auditTrail,
        {
          action: `Application packet for ${claim.claimId} exported for agency submission`,
          timestamp: new Date().toISOString(),
          performedBy: "Business Owner Approval",
        },
      ],
    });
  }, [claim]);

  const retry = useCallback(async () => {
    await initialize();
  }, [initialize]);

  const value = useMemo<ClaimContextValue>(
    () => ({
      claim,
      company: claim?.company ?? DEMO_COMPANY,
      invoice: claim?.invoice ?? DEMO_INVOICE,
      loading,
      error,
      isConnected,
      notice,
      pipeline,
      reEvaluate,
      approve,
      markSubmitted,
      retry,
    }),
    [
      claim,
      loading,
      error,
      isConnected,
      notice,
      pipeline,
      reEvaluate,
      approve,
      markSubmitted,
      retry,
    ],
  );

  return <ClaimContext.Provider value={value}>{children}</ClaimContext.Provider>;
}
