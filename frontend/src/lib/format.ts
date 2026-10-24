const MYT = "Asia/Kuala_Lumpur";

/** RM 5,000.00 — two decimals for money, with thousands separators. */
export function formatMYR(amount: number): string {
  return `RM ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** RM 5,000 — whole ringgit for headline figures; keeps sen when the amount has them (RM 1,234.50). */
export function formatMYRShort(amount: number): string {
  const whole = Number.isInteger(Math.round(amount * 100) / 100);
  return `RM ${amount.toLocaleString("en-US", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  })}`;
}

/** 22 Oct 2026, 16:30 — fixed zone so server and browser render the same text. */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: MYT });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: MYT });
  return `${date}, ${time}`;
}

/** 22 Oct 2026 — the Malaysia-time calendar day of a timestamp. */
export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: MYT });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: MYT,
  });
}

/** 2026-04-15 -> 15 Apr 2026 */
export function formatDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export const CATEGORY_LABEL: Record<string, string> = {
  DIGITAL_ERP: "Cloud ERP",
  HR_PAYROLL: "HR and payroll",
  E_INVOICING: "e-Invoicing",
  AUTOMATION_HARDWARE: "Automation hardware",
  EXPORT_EXHIBITION: "Export exhibition",
  OTHER: "Other",
};

export const STATUS_LABEL: Record<string, string> = {
  EVALUATED: "Evaluated",
  APPROVED: "Approved",
  SUBMITTED: "Submitted",
};

/** Completed calendar months from an ISO date to today (Malaysia time). Mirrors the backend's tenure rule. */
export function tenureMonthsFrom(isoDate: string, today: Date = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return null;
  const myt = new Date(today.getTime() + 8 * 3600 * 1000);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let months = (myt.getUTCFullYear() - y) * 12 + (myt.getUTCMonth() + 1 - mo);
  if (myt.getUTCDate() < d) months -= 1;
  return Math.max(months, 0);
}

/** 66 -> "5 yr 6 mo (66 months)" */
export function formatTenure(months: number): string {
  const y = Math.floor(months / 12);
  const mo = months % 12;
  const parts = [y ? `${y} yr` : "", mo || !y ? `${mo} mo` : ""].filter(Boolean).join(" ");
  return `${parts} (${months} month${months === 1 ? "" : "s"})`;
}
