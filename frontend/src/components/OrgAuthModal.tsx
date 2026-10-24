"use client";

import { useState, useEffect, useRef } from "react";
import { Building2, CheckCircle2, KeyRound, PlusCircle, UserCheck, X } from "lucide-react";
import type { OrganizationAccount, SMEProfile, SectorType } from "@/types/claim";
import { useClaim } from "@/lib/ClaimContext";
import { formatMYR, formatTenure, tenureMonthsFrom } from "@/lib/format";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";

interface Props {
  open: boolean;
  onClose: () => void;
  initialTab?: "switch" | "edit" | "register" | "login";
}

export function OrgAuthModal({ open, onClose, initialTab = "switch" }: Props) {
  const {
    currentOrg,
    organizations,
    company,
    switchOrganization,
    registerNewOrganization,
    loginToOrganization,
    updateCurrentOrgProfile,
  } = useClaim();

  const [tab, setTab] = useState<"switch" | "edit" | "register" | "login">(initialTab);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Edit / Register profile state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [incorporationDate, setIncorporationDate] = useState("");
  const [malaysianEquityPercentage, setMalaysianEquityPercentage] = useState<number | "">("");
  const [annualTurnoverMYR, setAnnualTurnoverMYR] = useState<number | "">("");
  const [fullTimeEmployees, setFullTimeEmployees] = useState<number | "">("");
  const [sector, setSector] = useState<SectorType>("SERVICES");
  const [isActiveExporter, setIsActiveExporter] = useState(false);
  const [isGlcOrMncOwned, setIsGlcOrMncOwned] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  useBodyScrollLock(open, modalRef);

  const populateFromCompany = (comp: SMEProfile) => {
    setCompanyName(comp.companyName);
    setRegistrationNumber(comp.registrationNumber);
    setIncorporationDate(comp.incorporationDate);
    setMalaysianEquityPercentage(comp.malaysianEquityPercentage);
    setAnnualTurnoverMYR(comp.annualTurnoverMYR);
    setFullTimeEmployees(comp.fullTimeEmployees);
    setSector(comp.sector);
    setIsActiveExporter(comp.isActiveExporter);
    setIsGlcOrMncOwned(comp.isGlcOrMncOwned);
  };

  const clearFormForRegister = () => {
    setTab("register");
    setFormError(null);
    setEmail("");
    setPassword("");
    setCompanyName("");
    setRegistrationNumber("");
    setIncorporationDate("");
    setMalaysianEquityPercentage("");
    setAnnualTurnoverMYR("");
    setFullTimeEmployees("");
    setSector("SERVICES");
    setIsActiveExporter(false);
    setIsGlcOrMncOwned(false);
  };

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      setTab(initialTab);
      setFormError(null);
      if (initialTab === "register") {
        clearFormForRegister();
      } else {
        populateFromCompany(company);
      }
    }
  }, [open, initialTab, company]);

  if (!open) return null;

  const buildProfilePayload = (): SMEProfile => ({
    companyName: companyName.trim() || "Malaysian Enterprise Sdn Bhd",
    registrationNumber: registrationNumber.trim() || "202401009988",
    incorporationDate: incorporationDate || "2023-01-15",
    // Derived from the incorporation date; the backend recomputes it the same way.
    tenureMonths: tenureMonthsFrom(incorporationDate || "2023-01-15") ?? 0,
    malaysianEquityPercentage: Number(malaysianEquityPercentage) || 60,
    annualTurnoverMYR: Number(annualTurnoverMYR) || 250000,
    fullTimeEmployees: Number(fullTimeEmployees) || 10,
    sector,
    isActiveExporter,
    isGlcOrMncOwned,
  });

  const handleSwitch = async (org: OrganizationAccount) => {
    setBusy(true);
    setFormError(null);
    try {
      await switchOrganization(org.id);
      onClose();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to switch organization");
    } finally {
      setBusy(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      await updateCurrentOrgProfile(buildProfilePayload());
      setTab("switch");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to update SSM profile");
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setFormError("Please enter an organization work email.");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await registerNewOrganization({
        email: email.trim(),
        password: password || "demo123",
        company: buildProfilePayload(),
      });
      setTab("switch");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to register organization");
    } finally {
      setBusy(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      await loginToOrganization({
        email: loginEmail.trim(),
        password: loginPassword,
      });
      setTab("switch");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Invalid organization email or password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="anim-fade fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4 backdrop-blur-[1px] overscroll-contain"
      role="dialog"
      aria-modal="true"
      aria-labelledby="org-auth-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="anim-pop flex max-h-[92vh] sm:max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-(--radius-card) border border-line bg-surface shadow-xl overscroll-contain"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-rule px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0 pr-2">
            <div className="inline-flex items-center gap-1.5 rounded-sm bg-accent-soft px-2 py-0.5 text-[10px] sm:text-small font-semibold text-accent tracking-wider">
              <Building2 size={12} className="shrink-0" />
              <span>ORGANIZATION & SSM REGISTRY</span>
            </div>
            <h2 id="org-auth-title" className="mt-1 text-base sm:text-section font-semibold text-ink leading-snug">
              SME Organization Account & SSM BizProfile
            </h2>
            <p className="mt-0.5 text-xs sm:text-small text-muted line-clamp-1 sm:line-clamp-none">
              Sign in, register a new SME, or update SSM information.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 -mr-1 rounded-md p-1.5 text-muted hover:bg-active hover:text-ink cursor-pointer"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs - horizontal scrolling on mobile to prevent jagged multiline wrap */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-rule bg-raised/50 px-3 sm:px-6 py-2">
          <button
            type="button"
            onClick={() => setTab("switch")}
            className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-(--radius-control) px-2.5 sm:px-3 text-xs sm:text-small font-medium cursor-pointer transition-colors whitespace-nowrap ${
              tab === "switch" ? "bg-ink text-surface shadow-xs" : "text-muted hover:bg-active hover:text-ink"
            }`}
          >
            <UserCheck size={13} className="shrink-0" />
            <span>Switch ({organizations.length})</span>
          </button>
          <button
            type="button"
            onClick={clearFormForRegister}
            className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-(--radius-control) px-2.5 sm:px-3 text-xs sm:text-small font-medium cursor-pointer transition-colors whitespace-nowrap ${
              tab === "register" ? "bg-ink text-surface shadow-xs" : "text-muted hover:bg-active hover:text-ink"
            }`}
          >
            <PlusCircle size={13} className="shrink-0" />
            <span>Sign Up New SME</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("login")}
            className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-(--radius-control) px-2.5 sm:px-3 text-xs sm:text-small font-medium cursor-pointer transition-colors whitespace-nowrap ${
              tab === "login" ? "bg-ink text-surface shadow-xs" : "text-muted hover:bg-active hover:text-ink"
            }`}
          >
            <KeyRound size={13} className="shrink-0" />
            <span>Sign In</span>
          </button>
          {tab === "edit" && (
            <button
              type="button"
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-(--radius-control) bg-ink px-2.5 sm:px-3 text-xs sm:text-small font-medium text-surface shadow-xs cursor-default whitespace-nowrap"
            >
              <Building2 size={13} className="shrink-0" />
              <span>Edit Profile</span>
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-6 overscroll-contain">
          {formError && (
            <div className="mb-3.5 sm:mb-4 rounded-(--radius-control) border border-rose-200 bg-rose-50 px-3 py-2 text-xs sm:text-small text-rose-700">
              {formError}
            </div>
          )}

          {tab === "switch" && (
            <div className="flex flex-col gap-2.5 sm:gap-3">
              <div className="flex flex-col gap-2 rounded-(--radius-control) border border-accent/30 bg-accent-soft/30 p-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs sm:text-small text-ink">
                  <span className="font-semibold">Demo mode.</span> The companies below are shared sample data that
                  anyone can open. To test grants with your own company, sign up your own SME: it stays private and
                  only appears after you sign in.
                </p>
                <button
                  type="button"
                  onClick={clearFormForRegister}
                  className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-(--radius-control) bg-ink px-3 text-xs sm:text-small font-medium text-surface cursor-pointer whitespace-nowrap"
                >
                  <PlusCircle size={13} className="shrink-0" />
                  Sign up your SME
                </button>
              </div>
              <p className="text-xs sm:text-small text-muted">
                Each organization maintains its own SSM profile, default invoice, and submitted grant history.
              </p>
              <div className="flex flex-col gap-2.5">
                {organizations.map((org) => {
                  const isActive = currentOrg?.id === org.id;
                  return (
                    <div
                      key={org.id}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 rounded-(--radius-card) border p-3 sm:p-4 transition-colors ${
                        isActive ? "border-accent bg-accent-soft/20 shadow-xs" : "border-line bg-surface hover:bg-raised/40"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-small sm:text-body font-semibold text-ink leading-tight">
                            {org.company.companyName}
                          </h3>
                          {isActive && (
                            <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold text-positive">
                              <CheckCircle2 size={11} /> Active
                            </span>
                          )}
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted num">
                          <span className="font-mono">SSM {org.company.registrationNumber}</span>
                          <span className="text-rule">•</span>
                          <span className="rounded bg-raised px-1.5 py-0.5 text-[10px] font-medium text-ink uppercase tracking-wider">
                            {org.company.sector}
                          </span>
                          <span className="text-rule">•</span>
                          <span>{org.company.malaysianEquityPercentage}% Equity</span>
                          <span className="text-rule">•</span>
                          <span>{org.company.fullTimeEmployees} FTEs</span>
                          <span className="text-rule">•</span>
                          <span className="font-medium text-ink">{formatMYR(org.company.annualTurnoverMYR)}</span>
                        </div>
                        <p className="mt-1 text-[11px] sm:text-xs text-muted truncate">
                          Account: <span className="font-mono text-ink/80">{org.email}</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={busy || isActive}
                        onClick={() => void handleSwitch(org)}
                        className={`h-8 sm:h-9 w-full sm:w-auto shrink-0 rounded-(--radius-control) px-3.5 sm:px-4 text-xs sm:text-small font-medium cursor-pointer transition-colors ${
                          isActive
                            ? "border border-control/70 bg-raised/80 text-muted cursor-default"
                            : "bg-ink text-surface hover:opacity-90 shadow-xs"
                        }`}
                      >
                        {isActive ? "Connected" : "Switch & Evaluate"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === "login" && (
            <form onSubmit={(e) => void handleLogin(e)} className="flex flex-col gap-3.5 sm:gap-4">
              <div>
                <label className="block text-xs sm:text-small font-medium text-ink mb-1">
                  Organization Work Email
                </label>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="h-9 w-full rounded-(--radius-control) border border-control bg-surface px-3 text-small"
                  placeholder="e.g. finance@yourcompany.com.my"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-small font-medium text-ink mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="h-9 w-full rounded-(--radius-control) border border-control bg-surface px-3 text-small"
                  placeholder="Enter your password"
                />
              </div>
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-9 w-full sm:w-auto rounded-(--radius-control) border border-control px-4 text-small font-medium hover:bg-active cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="h-9 w-full sm:w-auto rounded-(--radius-control) bg-ink px-5 text-small font-medium text-surface hover:opacity-90 cursor-pointer disabled:opacity-60 shadow-xs"
                >
                  {busy ? "Signing in..." : "Sign In"}
                </button>
              </div>
            </form>
          )}

          {(tab === "edit" || tab === "register") && (
            <form
              onSubmit={(e) => void (tab === "register" ? handleRegister(e) : handleSaveProfile(e))}
              className="flex flex-col gap-3.5 sm:gap-4"
            >
              {tab === "register" && (
                <div className="grid gap-3 sm:grid-cols-2 pb-2.5 sm:pb-3 border-b border-rule">
                  <div>
                    <label className="block text-xs sm:text-small font-medium text-ink mb-1">
                      Organization Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-9 w-full rounded-(--radius-control) border border-control bg-surface px-3 text-small"
                      placeholder="e.g. founder@my-sme.com.my"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-small font-medium text-ink mb-1">Password *</label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-9 w-full rounded-(--radius-control) border border-control bg-surface px-3 text-small"
                      placeholder="Create a secure password"
                    />
                  </div>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs sm:text-small font-medium text-ink mb-1">
                    SSM Registered Company Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="h-9 w-full rounded-(--radius-control) border border-control bg-surface px-3 text-small"
                    placeholder="e.g. Merdeka Tech Sdn Bhd"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-small font-medium text-ink mb-1">
                    SSM Registration Number (12-digit) *
                  </label>
                  <input
                    type="text"
                    required
                    value={registrationNumber}
                    onChange={(e) => setRegistrationNumber(e.target.value)}
                    className="h-9 w-full rounded-(--radius-control) border border-control bg-surface px-3 text-small num"
                    placeholder="e.g. 202301088412"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs sm:text-small font-medium text-ink mb-1">
                    Malaysian Equity (%) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    required
                    value={malaysianEquityPercentage}
                    onChange={(e) =>
                      setMalaysianEquityPercentage(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    className="h-9 w-full rounded-(--radius-control) border border-control bg-surface px-3 text-small num"
                    placeholder="e.g. 75"
                  />
                  <span className="text-[10px] sm:text-[11px] text-muted">MDEC/MIDA ≥60%, SME Corp ≥51%</span>
                </div>
                <div>
                  <p className="block text-xs sm:text-small font-medium text-ink mb-1">Operational Tenure</p>
                  <p className="flex h-9 items-center rounded-(--radius-control) bg-raised px-3 text-small num text-ink">
                    {incorporationDate && tenureMonthsFrom(incorporationDate) !== null
                      ? formatTenure(tenureMonthsFrom(incorporationDate)!)
                      : "Set incorporation date"}
                  </p>
                  <span className="text-[10px] sm:text-[11px] text-muted">From incorporation date</span>
                </div>
                <div>
                  <label className="block text-xs sm:text-small font-medium text-ink mb-1">
                    Full-Time Employees (FTE) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={2000}
                    required
                    value={fullTimeEmployees}
                    onChange={(e) =>
                      setFullTimeEmployees(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    className="h-9 w-full rounded-(--radius-control) border border-control bg-surface px-3 text-small num"
                    placeholder="e.g. 15"
                  />
                  <span className="text-[10px] sm:text-[11px] text-muted">HRD Corp Levy: ≥10 FTEs</span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs sm:text-small font-medium text-ink mb-1">
                    Annual Sales Turnover (MYR) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={10000}
                    required
                    value={annualTurnoverMYR}
                    onChange={(e) =>
                      setAnnualTurnoverMYR(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    className="h-9 w-full rounded-(--radius-control) border border-control bg-surface px-3 text-small num"
                    placeholder="e.g. 850000"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-small font-medium text-ink mb-1">
                    Primary Sector (SME Corp) *
                  </label>
                  <select
                    value={sector}
                    onChange={(e) => setSector(e.target.value as SectorType)}
                    className="h-9 w-full rounded-(--radius-control) border border-control bg-surface px-2.5 text-small text-ink"
                  >
                    <option value="SERVICES">SERVICES & OTHERS (ICT, Retail, Tech)</option>
                    <option value="MANUFACTURING">MANUFACTURING (Factory, Assembly)</option>
                  </select>
                  <span className="text-[10px] sm:text-[11px] text-muted">SME Corp classification</span>
                </div>
                <div>
                  <label className="block text-xs sm:text-small font-medium text-ink mb-1">
                    Incorporation Date
                  </label>
                  <input
                    type="date"
                    value={incorporationDate}
                    onChange={(e) => setIncorporationDate(e.target.value)}
                    className="h-9 w-full rounded-(--radius-control) border border-control bg-surface px-3 text-small num"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-6 rounded-(--radius-control) border border-line bg-raised/40 p-3">
                <label className="flex items-start gap-2.5 text-xs sm:text-small text-ink cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isActiveExporter}
                    onChange={(e) => setIsActiveExporter(e.target.checked)}
                    className="mt-0.5 size-4 shrink-0 rounded accent-ink"
                  />
                  <span>Registered Active Exporter (MATRADE MDG)</span>
                </label>
                <label className="flex items-start gap-2.5 text-xs sm:text-small text-ink cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isGlcOrMncOwned}
                    onChange={(e) => setIsGlcOrMncOwned(e.target.checked)}
                    className="mt-0.5 size-4 shrink-0 rounded accent-ink"
                  />
                  <span>≥20% GLC or MNC Corporate Holding</span>
                </label>
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-9 w-full sm:w-auto rounded-(--radius-control) border border-control px-4 text-small font-medium hover:bg-active cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="h-9 w-full sm:w-auto rounded-(--radius-control) bg-ink px-5 text-small font-medium text-surface hover:opacity-90 cursor-pointer disabled:opacity-60 shadow-xs"
                >
                  {busy
                    ? "Saving & Scoring 7 Grants..."
                    : tab === "register"
                      ? "Register SME & Evaluate Grants"
                      : "Save SSM Profile & Re-Evaluate"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
