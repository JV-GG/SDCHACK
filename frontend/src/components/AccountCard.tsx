"use client";

import { useId, useState } from "react";
import { KeyRound } from "lucide-react";
import { ApiError, changeOrgPassword } from "@/lib/api";
import { useClaim } from "@/lib/ClaimContext";
import { formatDateTime } from "@/lib/format";

function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  hint?: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-small text-muted">
        {label}
      </label>
      <input
        id={id}
        type="password"
        required
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="h-8 w-full rounded-(--radius-control) border border-control bg-surface px-2 text-body"
      />
      {hint && (
        <p id={`${id}-hint`} className="mt-0.5 text-small text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

/** The company account: who signs in, and the password used for sign-in and the audit trail. */
export function AccountCard() {
  const { currentOrg, openAuthModal } = useClaim();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  if (!currentOrg) return null;
  const orgId = currentOrg.id;

  const reset = () => {
    setCurrent("");
    setNext("");
    setConfirm("");
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 8) return setMessage({ tone: "error", text: "New password must be at least 8 characters." });
    if (next !== confirm) return setMessage({ tone: "error", text: "The new passwords do not match." });
    setBusy(true);
    setMessage(null);
    try {
      await changeOrgPassword(orgId, { currentPassword: current, newPassword: next });
      reset();
      setOpen(false);
      setMessage({ tone: "ok", text: "Password changed. Use the new password next time you sign in." });
    } catch (err) {
      const text =
        err instanceof ApiError && typeof err.detail === "string"
          ? err.detail
          : err instanceof Error
            ? err.message
            : "Could not change the password.";
      setMessage({ tone: "error", text });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="account-title" className="rounded-(--radius-card) border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 id="account-title" className="text-section font-semibold">
          Company account
        </h2>
        <button
          type="button"
          onClick={() => openAuthModal("switch")}
          className="text-small font-medium text-accent hover:underline cursor-pointer"
        >
          Switch or sign in
        </button>
      </div>
      <dl className="mt-2 divide-y divide-rule text-body">
        <div className="flex items-baseline justify-between gap-4 py-2">
          <dt className="text-muted">Sign-in email</dt>
          <dd className="min-w-0 break-all text-right">{currentOrg.email}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 py-2">
          <dt className="text-muted">Organisation ID</dt>
          <dd className="text-right font-mono">{currentOrg.id}</dd>
        </div>
        {currentOrg.createdAt && (
          <div className="flex items-baseline justify-between gap-4 py-2">
            <dt className="text-muted">Registered</dt>
            <dd className="text-right num">{formatDateTime(currentOrg.createdAt)}</dd>
          </div>
        )}
      </dl>
      <p className="mt-1 text-small text-muted">
        Actions are recorded in the audit trail under this email and the IP address used.
      </p>

      {message && (
        <p role="status" className={`mt-3 text-small ${message.tone === "ok" ? "text-positive" : "text-negative"}`}>
          {message.text}
        </p>
      )}

      {open ? (
        <form onSubmit={(e) => void submit(e)} className="mt-3 flex flex-col gap-2">
          <PasswordField label="Current password" value={current} onChange={setCurrent} autoComplete="current-password" />
          <PasswordField
            label="New password"
            value={next}
            onChange={setNext}
            autoComplete="new-password"
            hint="At least 8 characters."
          />
          <PasswordField label="Confirm new password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                reset();
                setMessage(null);
                setOpen(false);
              }}
              className="h-8 rounded-(--radius-control) px-3 text-body font-medium hover:bg-active cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !current || !next || !confirm}
              className="h-8 rounded-(--radius-control) bg-ink px-3 text-body font-medium text-surface hover:opacity-90 cursor-pointer disabled:opacity-50"
            >
              {busy ? "Changing…" : "Change password"}
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => {
            setMessage(null);
            setOpen(true);
          }}
          className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-(--radius-control) border border-control px-3 text-body font-medium hover:bg-active cursor-pointer"
        >
          <KeyRound size={14} aria-hidden="true" />
          Change password
        </button>
      )}
    </section>
  );
}
