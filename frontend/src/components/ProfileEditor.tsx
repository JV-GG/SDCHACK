"use client";

import { Fragment, useEffect, useId, useMemo, useState } from "react";
import { LoaderCircle, Pencil } from "lucide-react";
import type { ProfileImpactResponse, SMEProfile, SectorType } from "@/types/claim";
import { ApiError, previewOrgProfile } from "@/lib/api";
import { useClaim } from "@/lib/ClaimContext";
import { formatDate, formatDateTime, formatMYR, formatMYRShort, formatTenure, tenureMonthsFrom } from "@/lib/format";
import { ConfirmChangesDialog, type FieldChange } from "@/components/ConfirmChangesDialog";

type FieldKey = Exclude<keyof SMEProfile, "tenureMonths">;
type Kind = "text" | "registration" | "date" | "percent" | "count" | "money" | "sector" | "bool";

interface FieldDef {
  key: FieldKey;
  label: string;
  kind: Kind;
  hint?: string;
}

interface SectionDef {
  id: "ssm" | "hr" | "finance";
  title: string;
  /** Where the values come from today. Every value is self-declared until a live integration exists. */
  source: string;
  fields: FieldDef[];
}

const SECTIONS: SectionDef[] = [
  {
    id: "ssm",
    title: "Company and ownership",
    source: "Typed in by you. SSM isn't connected yet.",
    fields: [
      { key: "companyName", label: "Company name", kind: "text" },
      { key: "registrationNumber", label: "SSM number", kind: "registration", hint: "12 digits, e.g. 201801029384" },
      { key: "incorporationDate", label: "Started on", kind: "date", hint: "We work out how long you have been in business from this date" },
      { key: "malaysianEquityPercentage", label: "Malaysian-owned", kind: "percent" },
      { key: "sector", label: "Type of business", kind: "sector" },
      { key: "isGlcOrMncOwned", label: "20% or more owned by a GLC or multinational", kind: "bool" },
    ],
  },
  {
    id: "hr",
    title: "Staff",
    source: "Typed in by you. Orbyte HR isn't connected yet.",
    fields: [{ key: "fullTimeEmployees", label: "Full-time staff", kind: "count" }],
  },
  {
    id: "finance",
    title: "Money and trade",
    source: "Typed in by you. Accounting isn't connected yet.",
    fields: [
      { key: "annualTurnoverMYR", label: "Yearly sales", kind: "money" },
      { key: "isActiveExporter", label: "Registered exporter", kind: "bool", hint: "Listed in the MATRADE Exporter Registry" },
    ],
  },
];

type FormState = Record<FieldKey, string | boolean>;

function toForm(c: SMEProfile): FormState {
  return {
    companyName: c.companyName,
    registrationNumber: c.registrationNumber,
    incorporationDate: c.incorporationDate,
    malaysianEquityPercentage: String(c.malaysianEquityPercentage),
    sector: c.sector,
    isGlcOrMncOwned: c.isGlcOrMncOwned,
    fullTimeEmployees: String(c.fullTimeEmployees),
    annualTurnoverMYR: String(c.annualTurnoverMYR),
    isActiveExporter: c.isActiveExporter,
  };
}

/** Empty numeric inputs become NaN so the backend validator rejects them instead of saving 0. */
function fromForm(base: SMEProfile, f: FormState): SMEProfile {
  const num = (v: string | boolean) => (String(v).trim() === "" ? Number.NaN : Number(v));
  const incorporationDate = String(f.incorporationDate);
  return {
    ...base,
    companyName: String(f.companyName),
    registrationNumber: String(f.registrationNumber),
    incorporationDate,
    tenureMonths: tenureMonthsFrom(incorporationDate) ?? base.tenureMonths,
    malaysianEquityPercentage: num(f.malaysianEquityPercentage),
    sector: f.sector as SectorType,
    isGlcOrMncOwned: Boolean(f.isGlcOrMncOwned),
    fullTimeEmployees: num(f.fullTimeEmployees),
    annualTurnoverMYR: num(f.annualTurnoverMYR),
    isActiveExporter: Boolean(f.isActiveExporter),
  };
}

/** NaN cannot be sent as JSON; local checks catch what the server would otherwise reject as unparseable. */
function localErrors(p: SMEProfile): Record<string, string> {
  const e: Record<string, string> = {};
  if (!Number.isFinite(p.malaysianEquityPercentage)) e.malaysianEquityPercentage = "Enter a percentage.";
  if (!Number.isInteger(p.fullTimeEmployees)) e.fullTimeEmployees = "Enter a whole number of employees.";
  if (!Number.isFinite(p.annualTurnoverMYR)) e.annualTurnoverMYR = "Enter the annual turnover in RM.";
  return e;
}

function displayValue(c: SMEProfile, f: FieldDef): string {
  const v = c[f.key];
  switch (f.kind) {
    case "date":
      return formatDate(String(v));
    case "percent":
      return `${Number(Number(v).toFixed(1))}%`;
    case "money":
      return formatMYRShort(Number(v));
    case "sector":
      return v === "SERVICES" ? "Services" : "Manufacturing";
    case "bool":
      return v ? "Yes" : "No";
    default:
      return String(v);
  }
}

/** 87 -> "7 years 3 months" */
function formatYears(months: number): string {
  const y = Math.floor(months / 12);
  const m = months % 12;
  const part = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;
  if (y === 0) return part(m, "month");
  return m === 0 ? part(y, "year") : `${part(y, "year")} ${part(m, "month")}`;
}

/** A numeric jump big enough to look like a typo: 5x or more either way, or 30+ points of equity. */
function isLargeChange(kind: Kind, before: number, after: number): boolean {
  if (!Number.isFinite(before) || !Number.isFinite(after) || before === after) return false;
  if (kind === "percent") return Math.abs(after - before) >= 30;
  if (kind !== "count" && kind !== "money") return false;
  if (before <= 0) return false;
  const ratio = after / before;
  return ratio >= 5 || ratio <= 0.2;
}

/** The fields of one section whose draft value differs from the saved profile, as old -> new. */
function sectionChanges(def: SectionDef, saved: SMEProfile, draft: SMEProfile, normalized: SMEProfile | null): FieldChange[] {
  const out: FieldChange[] = [];
  for (const f of def.fields) {
    if (String(saved[f.key]) === String(draft[f.key])) continue;
    out.push({
      key: f.key,
      label: f.label,
      before: displayValue(saved, f),
      after: displayValue(draft, f),
      large: isLargeChange(f.kind, Number(saved[f.key]), Number(draft[f.key])),
    });
    // Tenure is derived from the incorporation date, so show its new value too.
    if (f.key === "incorporationDate" && normalized && normalized.tenureMonths !== saved.tenureMonths) {
      out.push({
        key: "tenureMonths",
        label: "Operating tenure (calculated)",
        before: formatTenure(saved.tenureMonths),
        after: formatTenure(normalized.tenureMonths),
        large: false,
      });
    }
  }
  return out;
}

function FieldInput({
  def,
  value,
  error,
  onChange,
}: {
  def: FieldDef;
  value: string | boolean;
  error?: string;
  onChange: (v: string | boolean) => void;
}) {
  const id = useId();
  const describedBy = [def.hint ? `${id}-hint` : "", error ? `${id}-err` : ""].filter(Boolean).join(" ") || undefined;
  const base = `h-11 w-full rounded-lg border bg-surface px-3 text-section num ${
    error ? "border-negative" : "border-control"
  }`;

  if (def.kind === "bool") {
    return (
      <div className="py-1">
        <label className="flex cursor-pointer items-center gap-2 text-body">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            aria-describedby={describedBy}
            className="size-4 accent-ink"
          />
          <span>{def.label}</span>
        </label>
        {def.hint && (
          <p id={`${id}-hint`} className="ml-6 text-small text-muted">
            {def.hint}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="py-1">
      <label htmlFor={id} className="mb-1 block text-small text-muted">
        {def.label}
      </label>
      {def.kind === "sector" ? (
        <select id={id} value={String(value)} onChange={(e) => onChange(e.target.value)} className={base} aria-describedby={describedBy}>
          <option value="SERVICES">Services</option>
          <option value="MANUFACTURING">Manufacturing</option>
        </select>
      ) : (
        <div className="relative">
          {def.kind === "money" && (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-body text-muted">RM</span>
          )}
          <input
            id={id}
            type={def.kind === "date" ? "date" : def.kind === "text" || def.kind === "registration" ? "text" : "number"}
            inputMode={def.kind === "registration" ? "numeric" : undefined}
            min={def.kind === "percent" || def.kind === "count" || def.kind === "money" ? 0 : undefined}
            max={def.kind === "percent" ? 100 : undefined}
            step={def.kind === "count" ? 1 : "any"}
            value={String(value)}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={`${base} ${def.kind === "money" ? "pl-10" : ""} ${def.kind === "percent" ? "pr-8" : ""}`}
          />
          {def.kind === "percent" && (
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-body text-muted">%</span>
          )}
        </div>
      )}
      {def.hint && !error && (
        <p id={`${id}-hint`} className="mt-0.5 text-small text-muted">
          {def.hint}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} role="alert" className="mt-0.5 text-small text-negative">
          {error}
        </p>
      )}
    </div>
  );
}

/** What saving the draft would change, from the backend's deterministic preview. */
function ImpactPanel({ preview, loading }: { preview: ProfileImpactResponse | null; loading: boolean }) {
  if (!preview) {
    return loading ? (
      <p className="flex items-center gap-2 text-small text-muted">
        <LoaderCircle size={12} className="animate-spin" aria-hidden="true" /> Checking impact…
      </p>
    ) : null;
  }
  const gained = preview.changes.filter((c) => c.after);
  const lost = preview.changes.filter((c) => !c.after);
  return (
    <div aria-live="polite" className="rounded-(--radius-control) bg-raised px-3 py-2 text-body">
      <p className="text-small font-semibold text-ink">
        If you save: you qualify for {preview.eligibleAfter} of 7 programmes
        {preview.eligibleAfter !== preview.eligibleBefore && ` (was ${preview.eligibleBefore})`}
        {loading && <LoaderCircle size={12} className="ml-1.5 inline animate-spin" aria-hidden="true" />}
      </p>
      {gained.map((c) => (
        <p key={c.grantId} className="mt-1 text-small text-positive">
          + Opens: {c.grantName} (up to {formatMYR(c.maxCoFundingMYR)})
        </p>
      ))}
      {lost.map((c) => (
        <p key={c.grantId} className="mt-1 text-small text-negative">
          − Closes: {c.grantName}
        </p>
      ))}
      {preview.changes.length === 0 && <p className="mt-0.5 text-small text-muted">No change to programme eligibility.</p>}
    </div>
  );
}

function Section({
  def,
  company,
  editing,
  disabled,
  onEdit,
  onDone,
}: {
  def: SectionDef;
  company: SMEProfile;
  editing: boolean;
  disabled: boolean;
  onEdit: () => void;
  onDone: (saved: boolean, impact: ProfileImpactResponse | null) => void;
}) {
  const { currentOrg, updateCurrentOrgProfile } = useClaim();
  const headingId = useId();
  const [form, setForm] = useState<FormState>(() => toForm(company));
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<ProfileImpactResponse | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Set when the user has asked to save: the edit is only applied after they confirm in the dialog.
  const [confirming, setConfirming] = useState<{ changes: FieldChange[]; impact: ProfileImpactResponse | null } | null>(null);

  // Only build the draft while editing: it reads the current date (tenure), which must not run during prerender.
  const draft = useMemo(() => (editing ? fromForm(company, form) : company), [editing, company, form]);
  const local = useMemo(() => localErrors(draft), [draft]);
  const dirty = JSON.stringify(toForm(company)) !== JSON.stringify(form);
  const orgId = currentOrg?.id;

  // Debounced, read-only preview of the draft against the saved profile.
  useEffect(() => {
    if (!editing || !orgId || Object.keys(local).length > 0) return;
    let alive = true;
    const t = setTimeout(() => {
      setPreviewing(true);
      previewOrgProfile(orgId, draft)
        .then((res) => {
          if (!alive) return;
          setPreview(res);
          setServerErrors(Object.fromEntries(res.fieldErrors.map((e) => [e.field, e.message])));
        })
        .catch(() => alive && setPreview(null))
        .finally(() => alive && setPreviewing(false));
    }, 350);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [editing, orgId, draft, local]);

  const errors = { ...serverErrors, ...local };
  const sectionErrors = def.fields.some((f) => errors[f.key]);
  // Errors in fields outside this section (e.g. legacy data) are shown so Save is never blocked silently.
  const otherErrors = Object.entries(errors).filter(([k]) => !def.fields.some((f) => f.key === k));
  const derivedTenure = editing ? tenureMonthsFrom(String(form.incorporationDate)) : null;

  const set = (key: FieldKey, v: string | boolean) => {
    setForm((f) => ({ ...f, [key]: v }));
    setServerErrors((e) => {
      const next = { ...e };
      delete next[key];
      return next;
    });
  };

  /** Step 1: check the draft with the server, then ask the user to confirm. Nothing is saved here. */
  async function requestSave() {
    if (Object.keys(errors).length > 0 || checking || saving) return;
    setChecking(true);
    setSaveError(null);
    try {
      const impact = orgId ? await previewOrgProfile(orgId, draft) : null;
      if (impact && impact.fieldErrors.length > 0) {
        setServerErrors(Object.fromEntries(impact.fieldErrors.map((e) => [e.field, e.message])));
        setSaveError("Fix the highlighted fields.");
        return;
      }
      const changes = sectionChanges(def, company, draft, impact?.company ?? null);
      if (changes.length === 0) {
        onDone(false, null); // nothing differs after normalisation
        return;
      }
      setConfirming({ changes, impact });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not check the change. Try again.");
    } finally {
      setChecking(false);
    }
  }

  /** Step 2: the user confirmed, so apply the edit. */
  async function confirmSave() {
    if (!confirming || saving) return;
    setSaving(true);
    try {
      await updateCurrentOrgProfile(draft);
      const impact = confirming.impact;
      setConfirming(null);
      onDone(true, impact);
    } catch (err) {
      setConfirming(null);
      if (err instanceof ApiError && err.status === 422) {
        setServerErrors(err.fieldErrors);
        setSaveError("Fix the highlighted fields.");
      } else {
        setSaveError(err instanceof Error ? err.message : "Could not save. Try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby={headingId} className="overflow-hidden rounded-[14px] border border-line bg-surface">
      <div className="flex items-center justify-between gap-3 bg-raised py-3 pl-5 pr-3">
        <div className="min-w-0">
          <h3 id={headingId} className="text-section font-semibold">
            {def.title}
          </h3>
          <p className="text-small text-muted">{def.source}</p>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => {
              setForm(toForm(company));
              setServerErrors({});
              setPreview(null);
              setSaveError(null);
              onEdit();
            }}
            disabled={disabled}
            aria-label={`Edit ${def.title}`}
            className="inline-flex min-h-10 flex-none items-center gap-1.5 rounded-lg border border-control bg-surface px-3.5 text-body font-medium hover:bg-active cursor-pointer disabled:opacity-50"
          >
            <Pencil size={14} aria-hidden="true" />
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <form
          className="anim-expand flex flex-col gap-2 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            void requestSave();
          }}
        >
          {def.fields.map((f) => (
            <div key={f.key}>
              <FieldInput def={f} value={form[f.key]} error={errors[f.key]} onChange={(v) => set(f.key, v)} />
              {f.key === "incorporationDate" && derivedTenure !== null && !errors.incorporationDate && (
                <p className="text-small text-ink">Operating tenure: {formatTenure(derivedTenure)}</p>
              )}
            </div>
          ))}
          {otherErrors.map(([k, msg]) => (
            <p key={k} className="text-small text-negative">
              {msg} (in another section)
            </p>
          ))}
          <ImpactPanel preview={dirty ? preview : null} loading={dirty && previewing} />
          {saveError && (
            <p role="alert" className="text-small text-negative">
              {saveError}
            </p>
          )}
          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => onDone(false, null)}
              disabled={saving || checking}
              className="h-8 rounded-(--radius-control) px-3 text-body font-medium hover:bg-active cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={checking || saving || !dirty || sectionErrors || otherErrors.length > 0}
              className="h-8 rounded-(--radius-control) bg-ink px-3 text-body font-medium text-surface hover:opacity-90 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {checking ? "Checking…" : "Check changes"}
            </button>
          </div>
        </form>
      ) : (
        <dl className="-mb-px -mr-px grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
          {def.fields.map((f) => (
            <Fragment key={f.key}>
              <div className="border-b border-r border-rule bg-surface px-5 py-4">
                <dt className="text-body text-muted">{f.label}</dt>
                <dd className="mt-1 text-[18px] font-semibold leading-snug break-words num">{displayValue(company, f)}</dd>
              </div>
              {f.key === "incorporationDate" && (
                <div className="border-b border-r border-rule bg-surface px-5 py-4">
                  <dt className="text-body text-muted">In business for</dt>
                  <dd className="mt-1 text-[18px] font-semibold leading-snug num">{formatYears(company.tenureMonths)}</dd>
                </div>
              )}
            </Fragment>
          ))}
        </dl>
      )}
      <ConfirmChangesDialog
        open={confirming !== null}
        sectionTitle={def.title}
        changes={confirming?.changes ?? []}
        impact={confirming?.impact ?? null}
        saving={saving}
        onCancel={() => setConfirming(null)}
        onConfirm={() => void confirmSave()}
      />
    </section>
  );
}

/**
 * The organisation profile the rules engine checks, editable one section at a time. Each value shows which
 * programmes' rules it meets; while editing, a live preview shows which programmes the change would unlock.
 */
export function ProfileEditor() {
  const { company, currentOrg } = useClaim();
  const [editing, setEditing] = useState<SectionDef["id"] | null>(null);
  const [result, setResult] = useState<ProfileImpactResponse | null>(null);
  const orgId = currentOrg?.id;

  const gained = result?.changes.filter((c) => c.after) ?? [];
  const lost = result?.changes.filter((c) => !c.after) ?? [];

  return (
    <div className="flex flex-col gap-4">
      {currentOrg?.updatedAt && (
        <p className="text-small text-muted">
          Last saved {formatDateTime(currentOrg.updatedAt)} by {currentOrg.email}
        </p>
      )}
      {result && (
        <div role="status" className="rounded-(--radius-card) border border-line bg-accent-soft px-4 py-3 text-body">
          <p className="font-medium">
            Saved.{result.eligibleAfter >= 0 && ` You now qualify for ${result.eligibleAfter} of 7 programmes.`}
          </p>
          {gained.length > 0 && <p className="text-positive">Now open: {gained.map((c) => c.grantName).join(", ")}</p>}
          {lost.length > 0 && <p className="text-negative">No longer open: {lost.map((c) => c.grantName).join(", ")}</p>}
          <button
            type="button"
            onClick={() => setResult(null)}
            className="mt-1 text-small font-medium text-accent hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}
      {SECTIONS.map((s) => (
        <Section
          key={`${orgId}-${s.id}`}
          def={s}
          company={company}
          editing={editing === s.id}
          disabled={editing !== null && editing !== s.id}
          onEdit={() => {
            setResult(null);
            setEditing(s.id);
          }}
          onDone={(saved, impact) => {
            setEditing(null);
            if (saved) setResult(impact ?? { company, fieldErrors: [], fieldInsights: [], changes: [], eligibleBefore: 0, eligibleAfter: -1 });
          }}
        />
      ))}
    </div>
  );
}
