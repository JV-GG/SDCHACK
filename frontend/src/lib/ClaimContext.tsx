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
  DocumentKind,
  DocumentSource,
  GrantEvaluation,
  Invoice,
  InvoiceItemCategory,
  LLMNarrative,
  OpportunityScanResponse,
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
  fetchLatestClaim,
  fetchOrganization,
  fetchOrganizations,
  fetchOrgOpportunities,
  fetchOrgSubmittedGrants,
  fetchTriggerEvents,
  loginOrganization,
  recordSession,
  registerOrganization,
  submitClaim,
  triggerCrawlGrants,
  triggerScanOpportunities,
  triggerSubmitInvoice,
  updateOrganizationProfile,
} from "@/lib/api";
import { DEMO_COMPANY, DEMO_INVOICE } from "@/lib/scenarios";
import { formatMYR } from "@/lib/format";
import { ToastContainer, type ToastMessage } from "@/components/Toast";
import { OrgAuthModal } from "@/components/OrgAuthModal";
import { NewInvoiceTriggerModal } from "@/components/NewInvoiceTriggerModal";

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
  /** True until the first claim has loaded (or failed): screens show skeletons instead of placeholder data. */
  booting: boolean;
  /** True while the organization's submitted grants are being fetched. */
  submittedLoading: boolean;
  error: string | null;
  isConnected: boolean;
  notice: string | null;
  submittedGrants: SubmittedGrantRecord[];
  toasts: ToastMessage[];
  showToast: (toast: Omit<ToastMessage, "id">) => void;
  dismissToast: (id: string) => void;
  pipeline: { running: boolean; step: number };
  reEvaluate: () => Promise<void>;
  approve: (narratives: LLMNarrative[]) => Promise<void>;
  /** Records submission on the server. Resolves true on success. */
  markSubmitted: (opts?: { grantIds?: string[]; verificationHash?: string }) => Promise<boolean>;
  retry: () => Promise<void>;
  // Auth & Organization Profile
  openAuthModal: (tab?: "switch" | "edit" | "register" | "login") => void;
  /** Opens the invoice modal; pass a target to apply for one specific year-round programme. */
  openInvoiceModal: (target?: ApplicationTarget) => void;
  switchOrganization: (orgId: string) => Promise<void>;
  registerNewOrganization: (req: OrganizationRegisterRequest) => Promise<void>;
  loginToOrganization: (req: OrganizationLoginRequest) => Promise<void>;
  updateCurrentOrgProfile: (company: SMEProfile) => Promise<void>;
  // Event-Driven Trigger Points
  runGrantCrawlTrigger: () => Promise<void>;
  runNewInvoiceTrigger: (newInvoice: Invoice, opts?: DocumentSubmitOptions) => Promise<void>;
  // Year-round profile opportunity scan (no invoice needed)
  opportunities: OpportunityScanResponse | null;
  opportunitiesLoading: boolean;
  runOpportunityScan: () => Promise<void>;
  /** Grant to open in review after a targeted application passed all invoice checks. */
  pendingReviewGrantId: string | null;
  clearPendingReview: () => void;
  /** The programme whose quotation/receipt opened the pending review, so the user can go back to it. */
  lastApplicationTarget: ApplicationTarget | null;
}

/** How a document was submitted, recorded in the server audit trail. */
export interface DocumentSubmitOptions {
  targetGrantId?: string;
  documentKind?: DocumentKind;
  documentSource?: DocumentSource;
}

/** A year-round programme the SME is applying for from the opportunity list. */
export interface ApplicationTarget {
  grantId: string;
  grantName: string;
  agency: string;
  /** QUOTATION for pre-approval schemes (apply before buying); RECEIPT for reimbursement schemes. */
  documentKind: "QUOTATION" | "RECEIPT";
  categories: InvoiceItemCategory[];
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

/** The public org list only has the demo SMEs, so keep the signed-in SME in the switcher too. */
function withOrg(list: OrganizationAccount[], org: OrganizationAccount): OrganizationAccount[] {
  return list.some((o) => o.id === org.id) ? list : [...list, org];
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
  const [submittedLoading, setSubmittedLoading] = useState<boolean>(true);
  const [pipeline, setPipeline] = useState({ running: false, step: 0 });
  const [opportunities, setOpportunities] = useState<OpportunityScanResponse | null>(null);
  const [opportunitiesLoading, setOpportunitiesLoading] = useState<boolean>(false);

  // Modal state
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<"switch" | "edit" | "register" | "login">("switch");
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoiceTarget, setInvoiceTarget] = useState<ApplicationTarget | null>(null);
  const [pendingReviewGrantId, setPendingReviewGrantId] = useState<string | null>(null);

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

  const loadOpportunities = useCallback(async (orgId: string) => {
    setOpportunitiesLoading(true);
    try {
      setOpportunities(await fetchOrgOpportunities(orgId));
    } catch {
      setOpportunities(null);
    } finally {
      setOpportunitiesLoading(false);
    }
  }, []);

  const loadOrgSubmittedAndTriggers = useCallback(async (orgId: string) => {
    // Year-round profile scan loads independently so a failure here never blocks the claim view.
    void loadOpportunities(orgId);
    setSubmittedLoading(true);
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
    } finally {
      setSubmittedLoading(false);
    }
  }, [loadOpportunities]);

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
          } else {
            setPipeline({ running: false, step: 0 });
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
          clearTimer();
          setLoading(false);
          setPipeline({ running: false, step: 0 });
        }
      }
    },
    [clearTimer, activeCompany, activeInvoice, currentOrg],
  );

  /**
   * Shows the organization's most recently saved claim so its audit trail survives reloads and switches.
   * Only evaluates (creating a new claim) when the organization has no saved claim yet.
   */
  const loadSavedOrEvaluate = useCallback(
    async (showPipeline: boolean, comp: SMEProfile, inv: Invoice, orgId: string) => {
      try {
        const saved = await fetchLatestClaim(orgId);
        if (saved) {
          runId.current++;
          setClaim(saved);
          setActiveCompany(saved.company);
          setActiveInvoice(saved.invoice);
          setIsConnected(true);
          setError(null);
          setLoading(false);
          return;
        }
      } catch {
        // fall through to a fresh evaluation
      }
      await runEvaluation(showPipeline, comp, inv, orgId);
    },
    [runEvaluation],
  );

  /** Initial load: check health, load organizations from Neon DB, and show the active SME's saved claim */
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
          if (found) {
            initialOrg = found;
          } else {
            // A signed-up SME is hidden from the public list; resume it directly by id.
            const own = await fetchOrganization(savedOrgId).catch(() => null);
            if (own) {
              initialOrg = own;
              setOrganizations([...orgs, own]);
            } else {
              localStorage.removeItem("sme_active_org_id");
            }
          }
        }
      }

      // First-ever visit: offer the sign-up tab once, so visitors can try their own SME instead of the shared demo.
      if (typeof window !== "undefined" && !localStorage.getItem("sme_welcome_seen")) {
        localStorage.setItem("sme_welcome_seen", "1");
        setAuthModalTab("register");
        setAuthModalOpen(true);
      }

      if (initialOrg) {
        setCurrentOrg(initialOrg);
        const comp = initialOrg.company;
        const inv = initialOrg.defaultInvoice ?? DEMO_INVOICE;
        setActiveCompany(comp);
        setActiveInvoice(inv);
        void recordSession({ orgId: initialOrg.id, reason: "RESUME" }).catch(() => {});
        await Promise.all([
          loadSavedOrEvaluate(false, comp, inv, initialOrg.id),
          loadOrgSubmittedAndTriggers(initialOrg.id),
        ]);
        // Automatically sync official Malaysian grant schemes in background without blocking
        void triggerCrawlGrants(initialOrg.id).catch(() => {});
      } else {
        await runEvaluation(false, DEMO_COMPANY, DEMO_INVOICE, "org-nusantara");
        void triggerCrawlGrants("org-nusantara").catch(() => {});
      }
    } catch (err) {
      setIsConnected(false);
      setError(err instanceof Error ? err.message : "Connection failed");
      setLoading(false);
    }
  }, [loadSavedOrEvaluate, runEvaluation, loadOrgSubmittedAndTriggers]);

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
      void recordSession({ orgId: target.id, reason: "SWITCH" }).catch(() => {});
      await Promise.all([
        loadSavedOrEvaluate(true, comp, inv, target.id),
        loadOrgSubmittedAndTriggers(target.id),
      ]);
      showToast({
        title: `Switched to ${comp.companyName}`,
        message: `SSM ${comp.registrationNumber} synced from Neon Postgres. Evaluated 7 Malaysian grant schemes.`,
        tone: "positive",
      });
    },
    [organizations, loadSavedOrEvaluate, loadOrgSubmittedAndTriggers, showToast],
  );

  const registerNewOrganization = useCallback(
    async (req: OrganizationRegisterRequest) => {
      const created = await registerOrganization(req);
      const updatedOrgs = await fetchOrganizations();
      setOrganizations(withOrg(updatedOrgs, created));
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
      const updatedOrgs = await fetchOrganizations().catch(() => []);
      if (updatedOrgs.length > 0) {
        setOrganizations(withOrg(updatedOrgs, org));
      }
      setCurrentOrg(org);
      if (typeof window !== "undefined") {
        localStorage.setItem("sme_active_org_id", org.id);
      }
      const inv = org.defaultInvoice ?? DEMO_INVOICE;
      setActiveCompany(org.company);
      setActiveInvoice(inv);
      await Promise.all([
        loadSavedOrEvaluate(true, org.company, inv, org.id),
        loadOrgSubmittedAndTriggers(org.id),
      ]);
      showToast({
        title: `Signed in as ${org.company.companyName}`,
        message: `Loaded SSM profile and submitted grant history from Neon Postgres.`,
        tone: "positive",
      });
    },
    [loadSavedOrEvaluate, loadOrgSubmittedAndTriggers, showToast],
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
        title: "Organisation profile saved",
        message: `Re-checked all 7 programmes for ${updated.company.companyName} against the updated profile.`,
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
      if (res.opportunities) {
        setOpportunities(res.opportunities);
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

  const runOpportunityScan = useCallback(async () => {
    const orgId = currentOrg?.id ?? "org-nusantara";
    setOpportunitiesLoading(true);
    try {
      const scan = await triggerScanOpportunities(orgId);
      setOpportunities(scan);
      setTriggerEvents(await fetchTriggerEvents(orgId));
      showToast({
        title: `Profile pre-qualifies for ${scan.eligibleCount} of ${scan.matches.length} programmes`,
        message: `${scan.openNowCount} accepting applications now. Scanned on SSM and HR data alone, no invoice needed.`,
        tone: "positive",
      });
    } catch (err) {
      showToast({
        title: "Opportunity scan failed",
        message: err instanceof Error ? err.message : "Could not reach the backend.",
        tone: "warning",
      });
    } finally {
      setOpportunitiesLoading(false);
    }
  }, [currentOrg, showToast]);

  const runNewInvoiceTrigger = useCallback(
    async (newInvoice: Invoice, opts?: DocumentSubmitOptions) => {
      const targetGrantId = opts?.targetGrantId;
      const orgId = currentOrg?.id ?? "org-nusantara";
      setLoading(true);
      setActiveInvoice(newInvoice);
      setPendingReviewGrantId(null);
      try {
        const pkg = await triggerSubmitInvoice(orgId, {
          company: activeCompany,
          invoice: newInvoice,
          documentKind: opts?.documentKind ?? "INVOICE",
          documentSource: opts?.documentSource ?? "MANUAL",
          targetGrantId: targetGrantId ?? null,
        });
        setClaim(pkg);
        const triggers = await fetchTriggerEvents(orgId);
        setTriggerEvents(triggers);
        const eligibleCount = pkg.evaluations.filter((e) => e.isEligible).length;
        const target = targetGrantId
          ? pkg.evaluations.find((e) => e.grantId === targetGrantId)
          : undefined;
        if (target?.isEligible) {
          // Hand straight over to Step 4: the owner still reviews and signs off.
          setPendingReviewGrantId(target.grantId);
          showToast({
            title: `${target.grantName} application ready for review`,
            message: `${formatMYR(target.maxCoFundingMYR)} co-funding on #${newInvoice.invoiceNumber}. Check the draft and sign off.`,
            tone: "positive",
          });
        } else if (target) {
          const unmet = target.checks.filter((c) => !c.passed).map((c) => c.ruleName);
          showToast({
            title: `#${newInvoice.invoiceNumber} does not meet ${target.grantName} yet`,
            message: `Not met: ${unmet.join(", ")}. See the grant below for how to qualify.`,
            tone: "warning",
          });
        } else {
          showToast({
            title: `Invoice #${newInvoice.invoiceNumber} Triggered Evaluation`,
            message: `Matched ${eligibleCount} of ${pkg.evaluations.length} Malaysian grants (${formatMYR(pkg.totalClaimableAmountMYR)} claimable).`,
            tone: "positive",
          });
        }
      } finally {
        setLoading(false);
      }
    },
    [currentOrg, activeCompany, showToast],
  );

  const approve = useCallback(
    async (narratives: LLMNarrative[]) => {
      if (!claim) return;
      // The server owns the trail: it compares narratives with its saved copy, records edits and the
      // sign-off with the account email and IP. Nothing is approved locally if the server is unreachable.
      try {
        const remote = await approveClaim({ ...claim, narratives }, currentOrg?.id);
        setClaim(remote);
        setNotice(null);
      } catch (err) {
        setNotice(
          `Sign-off was not recorded: ${err instanceof Error ? err.message : "backend unreachable"}. Try again.`,
        );
        throw err;
      }
    },
    [claim, currentOrg],
  );

  const markSubmitted = useCallback(
    async (opts?: { grantIds?: string[]; verificationHash?: string }) => {
      if (!claim) return false;
      const orgId = currentOrg?.id ?? "org-nusantara";
      try {
        const res = await submitClaim(claim.claimId, {
          grantIds: opts?.grantIds ?? null,
          verificationHash: opts?.verificationHash ?? null,
        });
        setClaim(res.claim);
        setSubmittedGrants((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          return [...res.records.filter((r) => !existingIds.has(r.id)), ...prev];
        });
        void fetchTriggerEvents(orgId)
          .then(setTriggerEvents)
          .catch(() => {});
        return true;
      } catch (err) {
        showToast({
          title: "Submission was not recorded",
          message: err instanceof Error ? err.message : "Backend unreachable. Try again.",
          tone: "warning",
        });
        return false;
      }
    },
    [claim, currentOrg, showToast],
  );

  const retry = useCallback(async () => {
    await initialize();
  }, [initialize]);

  const openAuthModal = useCallback(
    (tab: "switch" | "edit" | "register" | "login" = "switch") => {
      void fetchOrganizations()
        .then((orgs) => setOrganizations(orgs))
        .catch(() => {});
      setAuthModalTab(tab);
      setAuthModalOpen(true);
    },
    [],
  );

  const openInvoiceModal = useCallback((target?: ApplicationTarget) => {
    setInvoiceTarget(target ?? null);
    setInvoiceModalOpen(true);
  }, []);

  const clearPendingReview = useCallback(() => setPendingReviewGrantId(null), []);

  const value = useMemo<ClaimContextValue>(
    () => ({
      claim,
      company: claim?.company ?? activeCompany,
      invoice: claim?.invoice ?? activeInvoice,
      currentOrg,
      organizations,
      triggerEvents,
      loading,
      booting: claim === null && error === null,
      submittedLoading,
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
      opportunities,
      opportunitiesLoading,
      runOpportunityScan,
      pendingReviewGrantId,
      clearPendingReview,
      lastApplicationTarget: invoiceTarget,
    }),
    [
      claim,
      activeCompany,
      activeInvoice,
      currentOrg,
      organizations,
      triggerEvents,
      loading,
      submittedLoading,
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
      opportunities,
      opportunitiesLoading,
      runOpportunityScan,
      pendingReviewGrantId,
      clearPendingReview,
      invoiceTarget,
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
        key={invoiceTarget?.grantId ?? "general"}
        open={invoiceModalOpen}
        onClose={() => setInvoiceModalOpen(false)}
        target={invoiceTarget}
      />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ClaimContext.Provider>
  );
}
