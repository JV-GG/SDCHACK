import type {
  ClaimEvaluationRequest,
  ClaimsReadinessPackage,
  DossierExportResponse,
} from "@/types/claim";
import { MOCK_CLAIM_PACKAGE, SCENARIO_LIST } from "@/lib/mockData";

/** Base URL of the FastAPI service, including the version prefix. */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1").replace(/\/$/, "");

const TIMEOUT_MS = 8000;

export type ApiSource = "live" | "mock";

export interface ApiResult {
  data: ClaimsReadinessPackage;
  /** "live" only when the backend answered; "mock" when the fixture was used instead. */
  source: ApiSource;
  /** Why the fixture was used, when it was. */
  fallbackReason?: string;
}

async function request<T>(path: string, body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Backend answered ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** The fixture that matches the invoice being sent, or the default fixture. */
function fixtureFor(req: ClaimEvaluationRequest): ClaimsReadinessPackage {
  const match = SCENARIO_LIST.find((s) => s.request.invoice.invoiceNumber === req.invoice.invoiceNumber);
  return match?.claim ?? MOCK_CLAIM_PACKAGE;
}

function describe(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") return "The backend took too long to answer.";
  if (error instanceof Error && error.message.startsWith("Backend answered")) return error.message + ".";
  return "The backend could not be reached.";
}

/**
 * POST /claims/evaluate. Never throws: if the backend is offline, slow or returns an error, the
 * matching fixture comes back with source "mock" so the demo keeps working.
 */
export async function evaluateClaim(req: ClaimEvaluationRequest): Promise<ApiResult> {
  try {
    const data = await request<ClaimsReadinessPackage>("/claims/evaluate", req);
    return { data, source: "live" };
  } catch (error) {
    return { data: fixtureFor(req), source: "mock", fallbackReason: describe(error) };
  }
}

/**
 * POST /claims/{id}/approve. Returns null when the backend cannot be reached, so the caller can
 * record the approval locally.
 */
export async function approveClaim(claim: ClaimsReadinessPackage): Promise<ClaimsReadinessPackage | null> {
  try {
    return await request<ClaimsReadinessPackage>(`/claims/${encodeURIComponent(claim.claimId)}/approve`, claim);
  } catch {
    return null;
  }
}

/** POST /claims/export-dossier: the backend's printable dossier and its SHA-256 verification hash. */
export async function exportDossier(claim: ClaimsReadinessPackage): Promise<DossierExportResponse | null> {
  try {
    return await request<DossierExportResponse>("/claims/export-dossier", claim);
  } catch {
    return null;
  }
}

/**
 * SHA-256 of the packet as the browser holds it, for mock mode where there is no backend to sign it.
 * Any later change to the packet gives a different hash.
 */
export async function localPacketHash(claim: ClaimsReadinessPackage): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(claim));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
