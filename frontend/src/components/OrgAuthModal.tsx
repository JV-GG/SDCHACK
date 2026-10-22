"use client";

import { useState, useEffect } from "react";
import { Building2, CheckCircle2, KeyRound, PlusCircle, Sparkles, UserCheck, X } from "lucide-react";
import type { OrganizationAccount, SMEProfile, SectorType } from "@/types/claim";
import { useClaim } from "@/lib/ClaimContext";
import { formatMYR } from "@/lib/format";

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
  const [loginEmail, setLoginEmail] = useState("finance@nusantara.com.my");
  const [loginPassword, setLoginPassword] = useState("demo123");

  // Edit / Register profile state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("demo123");
  const [companyName, setCompanyName] = useState(company.companyName);
  const [registrationNumber, setRegistrationNumber] = useState(company.registrationNumber);
  const [incorporationDate, setIncorporationDate] = useState(company.incorporationDate);
  const [tenureMonths, setTenureMonths] = useState(company.tenureMonths);
  const [malaysianEquityPercentage, setMalaysianEquityPercentage] = useState(
    company.malaysianEquityPercentage,
  );
  const [annualTurnoverMYR, setAnnualTurnoverMYR] = useState(company.annualTurnoverMYR);
  const [fullTimeEmployees, setFullTimeEmployees] = useState(company.fullTimeEmployees);
  const [sector, setSector] = useState<SectorType>(company.sector);
  const [isActiveExporter, setIsActiveExporter] = useState(company.isActiveExporter);
  const [isGlcOrMncOwned, setIsGlcOrMncOwned] = useState(company.isGlcOrMncOwned);

  useEffect(() => {
    if (open) {
      setTab(initialTab);
      setFormError(null);
      setCompanyName(company.companyName);
      setRegistrationNumber(company.registrationNumber);
      setIncorporationDate(company.incorporationDate);
      setTenureMonths(company.tenureMonths);
      setMalaysianEquityPercentage(company.malaysianEquityPercentage);
      setAnnualTurnoverMYR(company.annualTurnoverMYR);
      setFullTimeEmployees(company.fullTimeEmployees);
      setSector(company.sector);
      setIsActiveExporter(company.isActiveExporter);
      setIsGlcOrMncOwned(company.isGlcOrMncOwned);
    }
  }, [open, initialTab, company]);

  if (!open) return null;

  const buildProfilePayload = (): SMEProfile => ({
    companyName: companyName.trim() || "Malaysian Enterprise Sdn Bhd",
    registrationNumber: registrationNumber.trim() || "202401009988",
    incorporationDate: incorporationDate || "2023-01-15",
    tenureMonths: Number(tenureMonths) || 12,
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
      onClose();
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
      onClose();
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
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Invalid organization email or password");
    } finally {
      setBusy(false);
    }
  };

  const startFreshRegisterDefaults = () => {
    setTab("register");
    setEmail("founder@my-sme.com.my");
    setCompanyName("Merdeka Tech & Manufacturing Sdn Bhd");
    setRegistrationNumber("202301088412");
    setIncorporationDate("2023-03-10");
    setTenureMonths(30);
    setMalaysianEquityPercentage(75);
    setAnnualTurnoverMYR(850000);
    setFullTimeEmployees(15);
    setSector("SERVICES");
    setIsActiveExporter(false);
    setIsGlcOrMncOwned(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="org-auth-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-rule px-6 py-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-sm bg-accent-soft px-2 py-0.5 text-small font-semibold text-accent">
              <Building2 size={13} />
              <span>NEON POSTGRES ORGANIZATION & SSM REGISTRY</span>
            </div>
            <h2 id="org-auth-title" className="mt-1.5 text-section font-semibold text-ink">
              SME Organization Account & SSM BizProfile
            </h2>
            <p className="text-small text-muted">
              Sign in, register a new SME, or update SSM metrics to trigger deterministic evaluation across 7 Malaysian grants.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted hover:bg-active hover:text-ink cursor-pointer"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-1 border-b border-rule bg-raised/50 px-6 py-2">
          <button
            type="button"
            onClick={() => setTab("switch")}
            className={`inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-control)] px-3 text-small font-medium cursor-pointer ${
              tab === "switch" ? "bg-ink text-surface" : "text-muted hover:bg-active hover:text-ink"
            }`}
          >
            <UserCheck size={14} />
            <span>Switch Organization ({organizations.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("edit")}
            className={`inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-control)] px-3 text-small font-medium cursor-pointer ${
              tab === "edit" ? "bg-ink text-surface" : "text-muted hover:bg-active hover:text-ink"
            }`}
          >
            <Sparkles size={14} />
            <span>Edit SSM & HR Profile</span>
          </button>
          <button
            type="button"
            onClick={startFreshRegisterDefaults}
            className={`inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-control)] px-3 text-small font-medium cursor-pointer ${
              tab === "register" ? "bg-ink text-surface" : "text-muted hover:bg-active hover:text-ink"
            }`}
          >
            <PlusCircle size={14} />
            <span>Sign Up New SME</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("login")}
            className={`inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-control)] px-3 text-small font-medium cursor-pointer ${
              tab === "login" ? "bg-ink text-surface" : "text-muted hover:bg-active hover:text-ink"
            }`}
          >
            <KeyRound size={14} />
            <span>Sign In</span>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-6">
          {formError && (
            <div className="mb-4 rounded-[var(--radius-control)] border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-small text-rose-700">
              {formError}
            </div>
          )}

          {tab === "switch" && (
            <div className="flex flex-col gap-3">
              <p className="text-body text-muted">
                Select any registered Malaysian SME stored in Neon Postgres. Each organization maintains its own SSM profile, default invoice, and submitted grant history.
              </p>
              {organizations.map((org) => {
                const isActive = currentOrg?.id === org.id;
                return (
                  <div
                    key={org.id}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-[var(--radius-card)] border p-4 transition-colors ${
                      isActive ? "border-accent bg-accent-soft/25" : "border-line bg-surface hover:bg-raised/40"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-body font-semibold text-ink truncate">
                          {org.company.companyName}
                        </h3>
                        {isActive && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-positive">
                            <CheckCircle2 size={12} /> Active
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-small text-muted num">
                        SSM {org.company.registrationNumber} · {org.company.sector} ·{" "}
                        {org.company.malaysianEquityPercentage}% MY Equity · {org.company.fullTimeEmployees} FTEs ·{" "}
                        {formatMYR(org.company.annualTurnoverMYR)} turnover
                      </p>
                      <p className="mt-0.5 text-small text-muted">
                        Account: <span className="font-mono">{org.email}</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busy || isActive}
                      onClick={() => void handleSwitch(org)}
                      className={`h-9 flex-none rounded-[var(--radius-control)] px-4 text-body font-medium cursor-pointer ${
                        isActive
                          ? "border border-control bg-raised text-muted cursor-default"
                          : "bg-ink text-surface hover:opacity-90"
                      }`}
                    >
                      {isActive ? "Connected" : "Switch & Evaluate"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {tab === "login" && (
            <form onSubmit={(e) => void handleLogin(e)} className="flex flex-col gap-4">
              <div>
                <label className="block text-small font-medium text-ink mb-1">
                  Organization Work Email
                </label>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="h-9 w-full rounded-[var(--radius-control)] border border-control bg-surface px-3 text-body"
                  placeholder="finance@nusantara.com.my"
                />
              </div>
              <div>
                <label className="block text-small font-medium text-ink mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="h-9 w-full rounded-[var(--radius-control)] border border-control bg-surface px-3 text-body"
                />
                <p className="mt-1 text-small text-muted">
                  Demo accounts: <code className="font-mono">finance@nusantara.com.my</code>,{" "}
                  <code className="font-mono">ops@precision-mfg.com.my</code>, or{" "}
                  <code className="font-mono">founder@kldigital.io</code> (password: <code className="font-mono">demo123</code>)
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-9 rounded-[var(--radius-control)] border border-control px-4 text-body font-medium hover:bg-active cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="h-9 rounded-[var(--radius-control)] bg-ink px-5 text-body font-medium text-surface hover:opacity-90 cursor-pointer disabled:opacity-60"
                >
                  {busy ? "Signing in..." : "Sign In & Sync Neon DB"}
                </button>
              </div>
            </form>
          )}

          {(tab === "edit" || tab === "register") && (
            <form
              onSubmit={(e) => void (tab === "register" ? handleRegister(e) : handleSaveProfile(e))}
              className="flex flex-col gap-4"
            >
              {tab === "register" && (
                <div className="grid gap-4 sm:grid-cols-2 pb-2 border-b border-rule">
                  <div>
                    <label className="block text-small font-medium text-ink mb-1">
                      Organization Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-9 w-full rounded-[var(--radius-control)] border border-control bg-surface px-3 text-body"
                      placeholder="finance@yourcompany.com.my"
                    />
                  </div>
                  <div>
                    <label className="block text-small font-medium text-ink mb-1">Password *</label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-9 w-full rounded-[var(--radius-control)] border border-control bg-surface px-3 text-body"
                    />
                  </div>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-small font-medium text-ink mb-1">
                    SSM Registered Company Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="h-9 w-full rounded-[var(--radius-control)] border border-control bg-surface px-3 text-body"
                  />
                </div>
                <div>
                  <label className="block text-small font-medium text-ink mb-1">
                    SSM Registration Number (12-digit) *
                  </label>
                  <input
                    type="text"
                    required
                    value={registrationNumber}
                    onChange={(e) => setRegistrationNumber(e.target.value)}
                    className="h-9 w-full rounded-[var(--radius-control)] border border-control bg-surface px-3 text-body num"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-small font-medium text-ink mb-1">
                    Malaysian Equity (%) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    required
                    value={malaysianEquityPercentage}
                    onChange={(e) => setMalaysianEquityPercentage(Number(e.target.value))}
                    className="h-9 w-full rounded-[var(--radius-control)] border border-control bg-surface px-3 text-body num"
                  />
                  <span className="text-[11px] text-muted">MDEC/MIDA ≥60%, SME Corp ≥51%</span>
                </div>
                <div>
                  <label className="block text-small font-medium text-ink mb-1">
                    Operational Tenure (Months) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={600}
                    required
                    value={tenureMonths}
                    onChange={(e) => setTenureMonths(Number(e.target.value))}
                    className="h-9 w-full rounded-[var(--radius-control)] border border-control bg-surface px-3 text-body num"
                  />
                  <span className="text-[11px] text-muted">Cradle: 6–36m, MITI: ≥36m</span>
                </div>
                <div>
                  <label className="block text-small font-medium text-ink mb-1">
                    Full-Time Employees (FTE) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={2000}
                    required
                    value={fullTimeEmployees}
                    onChange={(e) => setFullTimeEmployees(Number(e.target.value))}
                    className="h-9 w-full rounded-[var(--radius-control)] border border-control bg-surface px-3 text-body num"
                  />
                  <span className="text-[11px] text-muted">HRD Corp Mandatory Levy: ≥10 FTEs</span>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-small font-medium text-ink mb-1">
                    Annual Sales Turnover (MYR) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={10000}
                    required
                    value={annualTurnoverMYR}
                    onChange={(e) => setAnnualTurnoverMYR(Number(e.target.value))}
                    className="h-9 w-full rounded-[var(--radius-control)] border border-control bg-surface px-3 text-body num"
                  />
                </div>
                <div>
                  <label className="block text-small font-medium text-ink mb-1">
                    Primary Sector (SME Corp) *
                  </label>
                  <select
                    value={sector}
                    onChange={(e) => setSector(e.target.value as SectorType)}
                    className="h-9 w-full rounded-[var(--radius-control)] border border-control bg-surface px-3 text-body"
                  >
                    <option value="SERVICES">SERVICES</option>
                    <option value="MANUFACTURING">MANUFACTURING</option>
                  </select>
                </div>
                <div>
                  <label className="block text-small font-medium text-ink mb-1">
                    Incorporation Date
                  </label>
                  <input
                    type="date"
                    value={incorporationDate}
                    onChange={(e) => setIncorporationDate(e.target.value)}
                    className="h-9 w-full rounded-[var(--radius-control)] border border-control bg-surface px-3 text-body num"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-6 rounded-[var(--radius-control)] border border-line bg-raised/40 p-3.5">
                <label className="flex items-center gap-2 text-body cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActiveExporter}
                    onChange={(e) => setIsActiveExporter(e.target.checked)}
                    className="size-4 accent-ink"
                  />
                  <span>Registered Active Exporter (MATRADE MDG)</span>
                </label>
                <label className="flex items-center gap-2 text-body cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isGlcOrMncOwned}
                    onChange={(e) => setIsGlcOrMncOwned(e.target.checked)}
                    className="size-4 accent-ink"
                  />
                  <span>≥20% GLC or MNC Corporate Holding</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-9 rounded-[var(--radius-control)] border border-control px-4 text-body font-medium hover:bg-active cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="h-9 rounded-[var(--radius-control)] bg-ink px-5 text-body font-medium text-surface hover:opacity-90 cursor-pointer disabled:opacity-60"
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
