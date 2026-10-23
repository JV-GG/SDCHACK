import type {
  ClaimEvaluationRequest,
  ClaimsReadinessPackage,
  ClaimSubmitRequest,
  ClaimSubmitResponse,
  CrawlTriggerResponse,
  DemoScenario,
  DossierExportResponse,
  Invoice,
  OpportunityScanResponse,
  OrganizationAccount,
  OrganizationLoginRequest,
  OrganizationRegisterRequest,
  OrgAuditLogResponse,
  SessionEventRequest,
  SMEProfile,
  SubmittedGrantDBRecord,
  TriggerEventRecord,
} from "@/types/claim";

/** Base URL of the FastAPI service, including the version prefix. */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1").replace(/\/$/, "");

const TIMEOUT_MS = 25000;

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(`Request timed out after ${TIMEOUT_MS / 1000}s`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetchWithTimeout(`${API_URL}${path}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`Backend GET ${path} failed (${res.status}): ${errorText || res.statusText}`);
  }
  return (await res.json()) as T;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetchWithTimeout(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`Backend POST ${path} failed (${res.status}): ${errorText || res.statusText}`);
  }
  return (await res.json()) as T;
}

async function putJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetchWithTimeout(`${API_URL}${path}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`Backend PUT ${path} failed (${res.status}): ${errorText || res.statusText}`);
  }
  return (await res.json()) as T;
}

/** Check if the live FastAPI backend is reachable. */
export async function checkBackendHealth(): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await getJson<{ status: string; service: string }>("/health");
    return { ok: res.status === "ok", message: res.service };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Backend unreachable" };
  }
}

/** Fetch pre-configured Malaysian SME demo scenarios from the live backend. */
export async function fetchScenarios(): Promise<DemoScenario[]> {
  return await getJson<DemoScenario[]>("/scenarios");
}

/** Fetch all registered SME organizations from Neon Postgres. */
export async function fetchOrganizations(): Promise<OrganizationAccount[]> {
  return await getJson<OrganizationAccount[]>("/organizations");
}

/** Sign up / register a new SME organization with SSM details in Neon Postgres. */
export async function registerOrganization(payload: OrganizationRegisterRequest): Promise<OrganizationAccount> {
  return await postJson<OrganizationAccount>("/auth/register", payload);
}

/** Sign in an SME organization by email & password. */
export async function loginOrganization(payload: OrganizationLoginRequest): Promise<OrganizationAccount> {
  return await postJson<OrganizationAccount>("/auth/login", payload);
}

/** Update an SME organization's SSM & workforce profile in Neon Postgres. */
export async function updateOrganizationProfile(orgId: string, company: SMEProfile): Promise<OrganizationAccount> {
  return await putJson<OrganizationAccount>(`/organizations/${encodeURIComponent(orgId)}/profile`, company);
}

/**
 * Trigger Point 1: Crawl & sync official Malaysian grant portals into Neon Postgres
 * and re-evaluate the organization's current expenditure deterministically.
 */
export async function triggerCrawlGrants(
  orgId: string,
  request?: ClaimEvaluationRequest,
): Promise<CrawlTriggerResponse> {
  return await postJson<CrawlTriggerResponse>(
    `/triggers/crawl-grants?org_id=${encodeURIComponent(orgId)}`,
    request ?? null,
  );
}

/**
 * Trigger Point 2: Submit a new invoice for an organization, persist to Neon DB,
 * and evaluate all 7 Malaysian statutory grant rules deterministically.
 */
export async function triggerSubmitInvoice(
  orgId: string,
  request: ClaimEvaluationRequest,
): Promise<ClaimsReadinessPackage> {
  return await postJson<ClaimsReadinessPackage>(
    `/triggers/submit-invoice?org_id=${encodeURIComponent(orgId)}`,
    request,
  );
}

/**
 * Year-round opportunity scan (read-only): which programmes the SME can apply for on its
 * SSM/HR profile alone, with each scheme's application window. No invoice needed.
 */
export async function fetchOrgOpportunities(orgId: string): Promise<OpportunityScanResponse> {
  return await getJson<OpportunityScanResponse>(
    `/organizations/${encodeURIComponent(orgId)}/opportunities`,
  );
}

/** Trigger Point 3: run and log an on-demand profile opportunity scan for one organization. */
export async function triggerScanOpportunities(orgId: string): Promise<OpportunityScanResponse> {
  return await postJson<OpportunityScanResponse>(
    `/triggers/scan-opportunities?org_id=${encodeURIComponent(orgId)}`,
    null,
  );
}

/** Fetch recent event-driven trigger logs from Neon Postgres. */
export async function fetchTriggerEvents(orgId?: string): Promise<TriggerEventRecord[]> {
  const qs = orgId ? `?org_id=${encodeURIComponent(orgId)}` : "";
  return await getJson<TriggerEventRecord[]>(`/triggers${qs}`);
}

/** Fetch submitted grants for an organization from Neon Postgres. */
export async function fetchOrgSubmittedGrants(orgId: string): Promise<SubmittedGrantDBRecord[]> {
  return await getJson<SubmittedGrantDBRecord[]>(
    `/organizations/${encodeURIComponent(orgId)}/submitted-grants`,
  );
}

/** Save a submitted grant record to Neon Postgres. */
export async function saveOrgSubmittedGrant(
  orgId: string,
  record: SubmittedGrantDBRecord,
): Promise<SubmittedGrantDBRecord> {
  return await postJson<SubmittedGrantDBRecord>(
    `/organizations/${encodeURIComponent(orgId)}/submitted-grants`,
    record,
  );
}

/** Parse unstructured raw invoice text via DeepSeek AI. */
export async function parseRawInvoiceText(
  rawText: string,
  vendorNameHint?: string,
  orgId?: string,
): Promise<Invoice> {
  const qs = orgId ? `?org_id=${encodeURIComponent(orgId)}` : "";
  return await postJson<Invoice>(`/invoices/parse-raw${qs}`, { rawText, vendorNameHint });
}

/** Audits a resumed session (page load) or an organization switch, with the client IP captured server-side. */
export async function recordSession(payload: SessionEventRequest): Promise<void> {
  await postJson("/auth/session", payload);
}

/** The organization's most recently saved claim, or null when none exists yet. */
export async function fetchLatestClaim(orgId: string): Promise<ClaimsReadinessPackage | null> {
  const res = await fetchWithTimeout(`${API_URL}/organizations/${encodeURIComponent(orgId)}/claims/latest`, {
    headers: { Accept: "application/json" },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Backend GET latest claim failed (${res.status})`);
  return (await res.json()) as ClaimsReadinessPackage;
}

/** Records submission of an approved claim's grants on the server, which builds the records and audit entry. */
export async function submitClaim(claimId: string, payload: ClaimSubmitRequest): Promise<ClaimSubmitResponse> {
  return await postJson<ClaimSubmitResponse>(`/claims/${encodeURIComponent(claimId)}/submit`, payload);
}

/** Organization-wide audit log (newest first) with the hash-chain integrity result. */
export async function fetchOrgAuditEvents(orgId: string, limit = 200): Promise<OrgAuditLogResponse> {
  return await getJson<OrgAuditLogResponse>(
    `/organizations/${encodeURIComponent(orgId)}/audit-events?limit=${limit}`,
  );
}

/**
 * Evaluates a claim live using the deterministic rules engine + DeepSeek AI narrative generator (with Neon cache).
 */
export async function evaluateClaim(
  request: ClaimEvaluationRequest,
  orgId?: string,
): Promise<ClaimsReadinessPackage> {
  const qs = orgId ? `?org_id=${encodeURIComponent(orgId)}` : "";
  return await postJson<ClaimsReadinessPackage>(`/claims/evaluate${qs}`, request);
}

/**
 * Step 4 Human Approval: Records the sign-off on the live backend with audit entry.
 */
export async function approveClaim(
  claim: ClaimsReadinessPackage,
  orgId?: string,
): Promise<ClaimsReadinessPackage> {
  const qs = orgId ? `?org_id=${encodeURIComponent(orgId)}` : "";
  return await postJson<ClaimsReadinessPackage>(
    `/claims/${encodeURIComponent(claim.claimId)}/approve${qs}`,
    claim,
  );
}

/**
 * Step 5 Dossier Export: Generates official submission packet with cryptographic verification hash.
 */
export async function exportDossier(
  claim: ClaimsReadinessPackage,
  orgId?: string,
): Promise<DossierExportResponse | null> {
  const qs = orgId ? `?org_id=${encodeURIComponent(orgId)}` : "";
  try {
    return await postJson<DossierExportResponse>(`/claims/export-dossier${qs}`, claim);
  } catch {
    return null;
  }
}

/**
 * SHA-256 of the packet as the browser holds it.
 * Any change to the packet results in a different cryptographic digest.
 */
export async function localPacketHash(claim: ClaimsReadinessPackage): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(claim));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
