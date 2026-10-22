const MYT = "Asia/Kuala_Lumpur";

/** RM 5,000.00 — two decimals for money, with thousands separators. */
export function formatMYR(amount: number): string {
  return `RM ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** 22 Oct 2026, 16:30 — fixed zone so server and browser render the same text. */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: MYT });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: MYT });
  return `${date}, ${time}`;
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
