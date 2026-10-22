import type { ClaimEvaluationRequest, ClaimsReadinessPackage } from "@/types/claim";
import { MOCK_CLAIM_PACKAGE, SCENARIOS } from "@/lib/mockData";

/** Base URL of the FastAPI service, including the version prefix. */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1").replace(/\/$/, "");

const TIMEOUT_MS = 4000;

export type ApiSource = "live" | "mock";

export interface ApiResult {
  data: ClaimsReadinessPackage;
  /** "live" only when the backend answered; "mock" when the fixture was used instead. */
  source: ApiSource;
  /** Why the fixture was used, when it was. */
  fallbackReason?: string;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Backend answered ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** The fixture that matches the invoice being sent, or the default fixture. */
function fixtureFor(request: ClaimEvaluationRequest): ClaimsReadinessPackage {
  const match = Object.values(SCENARIOS).find((s) => s.request.invoice.invoiceNumber === request.invoice.invoiceNumber);
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
export async function evaluateClaim(request: ClaimEvaluationRequest): Promise<ApiResult> {
  try {
    const data = await postJson<ClaimsReadinessPackage>("/claims/evaluate", request);
    return { data, source: "live" };
  } catch (error) {
    return { data: fixtureFor(request), source: "mock", fallbackReason: describe(error) };
  }
}

/**
 * POST /claims/{id}/approve. Returns null when the backend cannot be reached, so the caller can
 * record the approval locally.
 */
export async function approveClaim(claim: ClaimsReadinessPackage): Promise<ClaimsReadinessPackage | null> {
  try {
    return await postJson<ClaimsReadinessPackage>(`/claims/${encodeURIComponent(claim.claimId)}/approve`, claim);
  } catch {
    return null;
  }
}
