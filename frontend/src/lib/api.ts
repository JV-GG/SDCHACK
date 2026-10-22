import type {
  ClaimEvaluationRequest,
  ClaimsReadinessPackage,
  DemoScenario,
  DossierExportResponse,
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

/**
 * Evaluates a claim live using the deterministic rules engine + DeepSeek AI narrative generator.
 */
export async function evaluateClaim(request: ClaimEvaluationRequest): Promise<ClaimsReadinessPackage> {
  return await postJson<ClaimsReadinessPackage>("/claims/evaluate", request);
}

/**
 * Step 4 Human Approval: Records the sign-off on the live backend with audit entry.
 */
export async function approveClaim(claim: ClaimsReadinessPackage): Promise<ClaimsReadinessPackage> {
  return await postJson<ClaimsReadinessPackage>(`/claims/${encodeURIComponent(claim.claimId)}/approve`, claim);
}

/**
 * Step 5 Dossier Export: Generates official submission packet with cryptographic verification hash.
 */
export async function exportDossier(claim: ClaimsReadinessPackage): Promise<DossierExportResponse> {
  return await postJson<DossierExportResponse>("/claims/export-dossier", claim);
}
