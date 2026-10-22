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
  OrganizationAccount,
  OrganizationLoginRequest,
  OrganizationRegisterRequest,
  SMEProfile,
  TriggerEventRecord,
} from "@/types/claim";
import {
  approveClaim,
  checkBackendHealth,
  evaluateClaim,
  fetchOrganizations,
  fetchOrgSubmittedGrants,
  fetchTriggerEvents,
  loginOrganization,
  registerOrganization,
  saveOrgSubmittedGrant,
  triggerCrawlGrants,
  triggerSubmitInvoice,
  updateOrganizationProfile,
} from "@/lib/api";
import { DEMO_COMPANY, DEMO_INVOICE } from "@/lib/scenarios";
import { formatMYR } from "@/lib/format";
import { ToastContainer, type ToastMessage } from "@/components/Toast";
import { OrgAuthModal } from "@/components/OrgAuthModal";
import { NewInvoiceTriggerModal } from "@/components/NewInvoiceTriggerModal";

export const JOURNEY_STEPS = [
  "Trigger",
  "Connected data",
  "Rules and AI",
  "Human approval",
  "Outcome",
] as const;

const PIPELINE_STEP_MS = 600;

export interface SubmittedGrantRecord {
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

interface ClaimContextValue {
  claim: ClaimsReadinessPackage | null;
  company: SMEProfile;
  invoice: Invoice;
  currentOrg: OrganizationAccount | null;
  organizations: OrganizationAccount[];
  triggerEvents: TriggerEventRecord[];
  loading: boolean;
  error: string | null;
  isConnected: boolean;
  notice: string | null;
  submittedGrants: SubmittedGrantRecord[];
  toasts: ToastMessage[];
  showToast: (toast: Omit<ToastMessage, "id">) => void;
  dismissToast: (id: string) => void;
  pipeline: { running: boolean; step: number };
  reEvaluate: () => Promise<void>;
  approve: (narratives: LLMNarrative[], edited: boolean) => Promise<void>;
  markSubmitted: (specificGrantId?: string) => void;
  retry: () => Promise<void>;
  // Auth & Organization Profile
  openAuthModal: (tab?: "switch" | "edit" | "register" | "login") => void;
  openInvoiceModal: () => void;
  switchOrganization: (orgId: string) => Promise<void>;
  registerNewOrganization: (req: OrganizationRegisterRequest) => Promise<void>;
  loginToOrganization: (req: OrganizationLoginRequest) => Promise<void>;
  updateCurrentOrgProfile: (company: SMEProfile) => Promise<void>;
  // Event-Driven Trigger Points
  runGrantCrawlTrigger: () => Promise<void>;
  runNewInvoiceTrigger: (newInvoice: Invoice) => Promise<void>;
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
  const [currentOrg, setCurrentOrg] = useState<OrganizationAccount | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationAccount[]>([]);
  const [activeCompany, setActiveCompany] = useState<SMEProfile>(DEMO_COMPANY);
  const [activeInvoice, setActiveInvoice] = useState<Invoice>(DEMO_INVOICE);
  const [triggerEvents, setTriggerEvents] = useState<TriggerEventRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [submittedGrants, setSubmittedGrants] = useState<SubmittedGrantRecord[]>([]);
  const [pipeline, setPipeline] = useState({ running: false, step: 0 });

  // Modal state
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<"switch" | "edit" | "register" | "login">("switch");
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runId = useRef(0);

  const clearTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((toast: Omit<ToastMessage, "id">) => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const loadOrgSubmittedAndTriggers = useCallback(async (orgId: string) => {
    try {
      const [dbSubmitted, dbTriggers] = await Promise.all([
        fetchOrgSubmittedGrants(orgId),
        fetchTriggerEvents(orgId),
      ]);
      setSubmittedGrants(dbSubmitted);
      setTriggerEvents(dbTriggers);
    } catch {
      // Fallback to localStorage if needed
      if (typeof window !== "undefined") {
        try {
          const saved = localStorage.getItem(`sme_submitted_grants_${orgId}`);
          if (saved) setSubmittedGrants(JSON.parse(saved));
        } catch {
          // ignore
        }
      }
    }
  }, []);

  /** Evaluate an SME profile + invoice against the FastAPI backend */
  const runEvaluation = useCallback(
    async (
      showPipeline = false,
      companyOverride?: SMEProfile,
      invoiceOverride?: Invoice,
      orgIdOverride?: string,
    ) => {
      const currentRun = ++runId.current;
      clearTimer();
      setLoading(true);
      setError(null);

      const targetCompany = companyOverride ?? activeCompany;
      const targetInvoice = invoiceOverride ?? activeInvoice;
      const targetOrgId = orgIdOverride ?? currentOrg?.id ?? "org-nusantara";

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
        const result = await evaluateClaim(
          { company: targetCompany, invoice: targetInvoice },
          targetOrgId,
        );

        if (currentRun === runId.current) {
          setClaim(result);
          setActiveCompany(result.company);
          setActiveInvoice(result.invoice);
          setIsConnected(true);
          setError(null);
        }
      } catch (err) {
        if (currentRun === runId.current) {
          const msg =
            err instanceof Error ? err.message : "Failed to evaluate claim on live backend.";
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
    [clearTimer, activeCompany, activeInvoice, currentOrg],
  );

  /** Initial load: check health, load organizations from Neon DB, and evaluate active SME */
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

      const orgs = await fetchOrganizations();
      setOrganizations(orgs);

      let initialOrg = orgs[0] ?? null;
      if (typeof window !== "undefined") {
        const savedOrgId = localStorage.getItem("sme_active_org_id");
        if (savedOrgId) {
          const found = orgs.find((o) => o.id === savedOrgId);
          if (found) initialOrg = found;
        }
      }

      if (initialOrg) {
        setCurrentOrg(initialOrg);
        const comp = initialOrg.company;
        const inv = initialOrg.defaultInvoice ?? DEMO_INVOICE;
        setActiveCompany(comp);
        setActiveInvoice(inv);
        await Promise.all([
          runEvaluation(false, comp, inv, initialOrg.id),
          loadOrgSubmittedAndTriggers(initialOrg.id),
        ]);
      } else {
        await runEvaluation(false, DEMO_COMPANY, DEMO_INVOICE, "org-nusantara");
      }
    } catch (err) {
      setIsConnected(false);
      setError(err instanceof Error ? err.message : "Connection failed");
      setLoading(false);
    }
  }, [runEvaluation, loadOrgSubmittedAndTriggers]);

  useEffect(() => {
    void initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reEvaluate = useCallback(async () => {
    await runEvaluation(true);
  }, [runEvaluation]);

  const switchOrganization = useCallback(
    async (orgId: string) => {
      const target = organizations.find((o) => o.id === orgId);
      if (!target) return;
      setCurrentOrg(target);
      if (typeof window !== "undefined") {
        localStorage.setItem("sme_active_org_id", target.id);
      }
      const comp = target.company;
      const inv = target.defaultInvoice ?? DEMO_INVOICE;
      setActiveCompany(comp);
      setActiveInvoice(inv);
      await Promise.all([
        runEvaluation(true, comp, inv, target.id),
        loadOrgSubmittedAndTriggers(target.id),
      ]);
      showToast({
        title: `Switched to ${comp.companyName}`,
        message: `SSM ${comp.registrationNumber} synced from Neon Postgres. Evaluated 7 Malaysian grant schemes.`,
        tone: "positive",
      });
    },
    [organizations, runEvaluation, loadOrgSubmittedAndTriggers, showToast],
  );

  const registerNewOrganization = useCallback(
    async (req: OrganizationRegisterRequest) => {
      const created = await registerOrganization(req);
      const updatedOrgs = await fetchOrganizations();
      setOrganizations(updatedOrgs);
      setCurrentOrg(created);
      if (typeof window !== "undefined") {
        localStorage.setItem("sme_active_org_id", created.id);
      }
      const inv = created.defaultInvoice ?? DEMO_INVOICE;
      setActiveCompany(created.company);
      setActiveInvoice(inv);
      await Promise.all([
        runEvaluation(true, created.company, inv, created.id),
        loadOrgSubmittedAndTriggers(created.id),
      ]);
      showToast({
        title: "SME Organization Registered in Neon DB",
        message: `${created.company.companyName} (SSM ${created.company.registrationNumber}) onboarded and evaluated.`,
        tone: "positive",
      });
    },
    [runEvaluation, loadOrgSubmittedAndTriggers, showToast],
  );

  const loginToOrganization = useCallback(
    async (req: OrganizationLoginRequest) => {
      const org = await loginOrganization(req);
      setCurrentOrg(org);
      if (typeof window !== "undefined") {
        localStorage.setItem("sme_active_org_id", org.id);
      }
      const inv = org.defaultInvoice ?? DEMO_INVOICE;
      setActiveCompany(org.company);
      setActiveInvoice(inv);
      await Promise.all([
        runEvaluation(true, org.company, inv, org.id),
        loadOrgSubmittedAndTriggers(org.id),
      ]);
      showToast({
        title: `Signed in as ${org.company.companyName}`,
        message: `Loaded SSM profile and submitted grant history from Neon Postgres.`,
        tone: "positive",
      });
    },
    [runEvaluation, loadOrgSubmittedAndTriggers, showToast],
  );

  const updateCurrentOrgProfile = useCallback(
    async (newCompany: SMEProfile) => {
      const orgId = currentOrg?.id ?? "org-nusantara";
      const updated = await updateOrganizationProfile(orgId, newCompany);
      setCurrentOrg(updated);
      setActiveCompany(updated.company);
      const updatedOrgs = await fetchOrganizations();
      setOrganizations(updatedOrgs);
      await Promise.all([
        runEvaluation(true, updated.company, activeInvoice, orgId),
        loadOrgSubmittedAndTriggers(orgId),
      ]);
      showToast({
        title: "SSM & Workforce Profile Updated",
        message: `Trigger fired: Re-evaluated 7 statutory grants for ${updated.company.companyName}.`,
        tone: "positive",
      });
    },
    [currentOrg, activeInvoice, runEvaluation, loadOrgSubmittedAndTriggers, showToast],
  );

  const runGrantCrawlTrigger = useCallback(async () => {
    const orgId = currentOrg?.id ?? "org-nusantara";
    setLoading(true);
    try {
      const res = await triggerCrawlGrants(orgId, {
        company: activeCompany,
        invoice: activeInvoice,
      });
      if (res.updatedClaim) {
        setClaim(res.updatedClaim);
      }
      const triggers = await fetchTriggerEvents(orgId);
      setTriggerEvents(triggers);
      showToast({
        title: `Synced ${res.syncedCount} Official Malaysian Grant Schemes`,
        message:
          "Crawled MDEC, SME Corp, MATRADE, HRD Corp, MIDA, MITI & Cradle Fund. Deterministic scoring complete (0 DeepSeek tokens wasted).",
        tone: "positive",
      });
    } finally {
      setLoading(false);
    }
  }, [currentOrg, activeCompany, activeInvoice, showToast]);

  const runNewInvoiceTrigger = useCallback(
    async (newInvoice: Invoice) => {
      const orgId = currentOrg?.id ?? "org-nusantara";
      setLoading(true);
      setActiveInvoice(newInvoice);
      try {
        const pkg = await triggerSubmitInvoice(orgId, {
          company: activeCompany,
          invoice: newInvoice,
        });
        setClaim(pkg);
        const triggers = await fetchTriggerEvents(orgId);
        setTriggerEvents(triggers);
        const eligibleCount = pkg.evaluations.filter((e) => e.isEligible).length;
        showToast({
          title: `Invoice #${newInvoice.invoiceNumber} Triggered Evaluation`,
          message: `Matched ${eligibleCount} of ${pkg.evaluations.length} Malaysian grants (${formatMYR(pkg.totalClaimableAmountMYR)} claimable).`,
          tone: "positive",
        });
      } finally {
        setLoading(false);
      }
    },
    [currentOrg, activeCompany, showToast],
  );

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
        const remote = await approveClaim(local, currentOrg?.id);
        setClaim(remote);
        setNotice(null);
      } catch {
        setClaim(local);
        setNotice("Saved locally. Could not sync approval to backend.");
      }
    },
    [claim, currentOrg],
  );

  const markSubmitted = useCallback(
    (specificGrantId?: string) => {
      if (!claim) return;
      const orgId = currentOrg?.id ?? "org-nusantara";
      const nowIso = new Date().toISOString();
      const updatedClaim: ClaimsReadinessPackage = {
        ...claim,
        status: specificGrantId ? claim.status : "SUBMITTED",
        auditTrail: [
          ...claim.auditTrail,
          {
            action: `Application packet for ${claim.claimId} (${specificGrantId ?? "all eligible"}) exported & submitted`,
            timestamp: nowIso,
            performedBy: "Business Owner Approval",
          },
        ],
      };
      setClaim(updatedClaim);

      const eligible = eligibleGrants(claim);
      const toSubmit = specificGrantId
        ? eligible.filter((g) => g.grantId === specificGrantId)
        : eligible;

      const newRecords: SubmittedGrantRecord[] = toSubmit.map((g) => ({
        id: `${orgId}-${claim.claimId}-${g.grantId}`,
        orgId,
        claimId: claim.claimId,
        grantId: g.grantId,
        grantName: g.grantName,
        agency: g.agency,
        claimableAmountMYR: coFunding(claim, g).claimable,
        matchingPercentage: g.matchingPercentage,
        invoiceNumber: claim.invoice.invoiceNumber,
        vendorName: claim.invoice.vendorName,
        submittedAt: nowIso,
        claimSnapshot: updatedClaim,
      }));

      // Persist each submitted grant to Neon Postgres in background
      for (const rec of newRecords) {
        void saveOrgSubmittedGrant(orgId, rec).catch(() => {
          // fallback handled locally
        });
      }

      setSubmittedGrants((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const fresh = newRecords.filter((r) => !existingIds.has(r.id));
        const combined = [...fresh, ...prev];
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(`sme_submitted_grants_${orgId}`, JSON.stringify(combined));
          } catch {
            // ignore storage error
          }
        }
        return combined;
      });
    },
    [claim, currentOrg],
  );

  const retry = useCallback(async () => {
    await initialize();
  }, [initialize]);

  const openAuthModal = useCallback(
    (tab: "switch" | "edit" | "register" | "login" = "switch") => {
      setAuthModalTab(tab);
      setAuthModalOpen(true);
    },
    [],
  );

  const openInvoiceModal = useCallback(() => {
    setInvoiceModalOpen(true);
  }, []);

  const value = useMemo<ClaimContextValue>(
    () => ({
      claim,
      company: claim?.company ?? activeCompany,
      invoice: claim?.invoice ?? activeInvoice,
      currentOrg,
      organizations,
      triggerEvents,
      loading,
      error,
      isConnected,
      notice,
      submittedGrants,
      toasts,
      showToast,
      dismissToast,
      pipeline,
      reEvaluate,
      approve,
      markSubmitted,
      retry,
      openAuthModal,
      openInvoiceModal,
      switchOrganization,
      registerNewOrganization,
      loginToOrganization,
      updateCurrentOrgProfile,
      runGrantCrawlTrigger,
      runNewInvoiceTrigger,
    }),
    [
      claim,
      activeCompany,
      activeInvoice,
      currentOrg,
      organizations,
      triggerEvents,
      loading,
      error,
      isConnected,
      notice,
      submittedGrants,
      toasts,
      showToast,
      dismissToast,
      pipeline,
      reEvaluate,
      approve,
      markSubmitted,
      retry,
      openAuthModal,
      openInvoiceModal,
      switchOrganization,
      registerNewOrganization,
      loginToOrganization,
      updateCurrentOrgProfile,
      runGrantCrawlTrigger,
      runNewInvoiceTrigger,
    ],
  );

  return (
    <ClaimContext.Provider value={value}>
      {children}
      <OrgAuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialTab={authModalTab}
      />
      <NewInvoiceTriggerModal
        open={invoiceModalOpen}
        onClose={() => setInvoiceModalOpen(false)}
      />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ClaimContext.Provider>
  );
}
