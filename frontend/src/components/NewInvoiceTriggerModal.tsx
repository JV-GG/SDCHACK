"use client";

import { useState } from "react";
import { FilePlus2, Sparkles, X } from "lucide-react";
import type { Invoice, InvoiceLineItem } from "@/types/claim";
import { useClaim } from "@/lib/ClaimContext";
import { parseRawInvoiceText } from "@/lib/api";
import { formatMYR } from "@/lib/format";

interface Props {
  open: boolean;
  onClose: () => void;
}

const PRESET_INVOICES: { label: string; badge: string; invoice: Invoice }[] = [
  {
    label: "LHDN MyInvois e-Invoicing & Orbyte Cloud Payroll",
    badge: "Unlocks MDEC + HRD Corp (if ≥10 FTEs)",
    invoice: {
      invoiceNumber: "INV-MDEC-9082",
      invoiceDate: "2026-10-18",
      vendorName: "CloudTech Malaysia Sdn Bhd (MDEC TSP #0421)",
      vendorIsMdecTsp: true,
      totalAmountMYR: 10000,
      items: [
        {
          id: "item-1",
          description: "LHDN e-Invoicing Compliance Module",
          category: "E_INVOICING",
          quantity: 1,
          unitPriceMYR: 6000,
          totalPriceMYR: 6000,
        },
        {
          id: "item-2",
          description: "Orbyte Payroll & Statutory EPF/SOCSO/PCB Cloud Module",
          category: "HR_PAYROLL",
          quantity: 1,
          unitPriceMYR: 4000,
          totalPriceMYR: 4000,
        },
      ],
    },
  },
  {
    label: "Industry 4.0 Factory Robotics + MES ERP + Workforce Training",
    badge: "Multi-Agency Stack: SME Corp + MIDA + MITI + MDEC + HRD Corp",
    invoice: {
      invoiceNumber: "INV-AUTO-7740",
      invoiceDate: "2026-10-20",
      vendorName: "AseanTech Automation & Cloud Systems Sdn Bhd (MDEC TSP #0812)",
      vendorIsMdecTsp: true,
      totalAmountMYR: 280000,
      items: [
        {
          id: "item-101",
          description: "6-Axis CNC Cobot Palletizing Cell & PLC Vision Sensor Suite",
          category: "AUTOMATION_HARDWARE",
          quantity: 1,
          unitPriceMYR: 255000,
          totalPriceMYR: 255000,
        },
        {
          id: "item-102",
          description: "MES Manufacturing Execution ERP & LHDN e-Invoicing Sync",
          category: "DIGITAL_ERP",
          quantity: 1,
          unitPriceMYR: 15000,
          totalPriceMYR: 15000,
        },
        {
          id: "item-103",
          description: "HRD Corp SBL-Khas Workforce Upskilling & Payroll System",
          category: "HR_PAYROLL",
          quantity: 1,
          unitPriceMYR: 10000,
          totalPriceMYR: 10000,
        },
      ],
    },
  },
  {
    label: "International Export Trade Fair & Booth Package (Tokyo / Dubai)",
    badge: "Unlocks MATRADE MDG (for Active Exporters)",
    invoice: {
      invoiceNumber: "INV-EXP-4410",
      invoiceDate: "2026-10-22",
      vendorName: "GlobalExpo Trade Services Sdn Bhd",
      vendorIsMdecTsp: false,
      totalAmountMYR: 45000,
      items: [
        {
          id: "item-301",
          description: "International Trade Exhibition Booth Space & Export Promotion",
          category: "EXPORT_EXHIBITION",
          quantity: 1,
          unitPriceMYR: 45000,
          totalPriceMYR: 45000,
        },
      ],
    },
  },
  {
    label: "Early-Stage SaaS & Cloud ERP Commercialisation Stack",
    badge: "Unlocks Cradle CIP Spark (6–36m tenure) + MDEC",
    invoice: {
      invoiceNumber: "INV-SPARK-301",
      invoiceDate: "2026-10-21",
      vendorName: "CloudTech Malaysia Sdn Bhd (MDEC TSP #0421)",
      vendorIsMdecTsp: true,
      totalAmountMYR: 24000,
      items: [
        {
          id: "item-201",
          description: "Cloud ERP Core Infrastructure & Commercialisation Stack",
          category: "DIGITAL_ERP",
          quantity: 1,
          unitPriceMYR: 18000,
          totalPriceMYR: 18000,
        },
        {
          id: "item-202",
          description: "LHDN MyInvois API Gateway Module",
          category: "E_INVOICING",
          quantity: 1,
          unitPriceMYR: 6000,
          totalPriceMYR: 6000,
        },
      ],
    },
  },
];

export function NewInvoiceTriggerModal({ open, onClose }: Props) {
  const { invoice, runNewInvoiceTrigger } = useClaim();
  const [invoiceNumber, setInvoiceNumber] = useState(invoice.invoiceNumber);
  const [invoiceDate, setInvoiceDate] = useState(invoice.invoiceDate);
  const [vendorName, setVendorName] = useState(invoice.vendorName);
  const [vendorIsMdecTsp, setVendorIsMdecTsp] = useState(invoice.vendorIsMdecTsp);
  const [itemDesc, setItemDesc] = useState(
    invoice.items[0]?.description ?? "LHDN e-Invoicing & Cloud ERP Suite",
  );
  const [itemCategory, setItemCategory] = useState<InvoiceLineItem["category"]>(
    invoice.items[0]?.category ?? "E_INVOICING",
  );
  const [itemAmount, setItemAmount] = useState<number>(invoice.totalAmountMYR || 10000);
  const [rawText, setRawText] = useState("");
  const [busy, setBusy] = useState(false);
  const [parsing, setParsing] = useState(false);

  if (!open) return null;

  const handleTriggerPreset = async (preset: Invoice) => {
    setBusy(true);
    try {
      await runNewInvoiceTrigger(preset);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const handleParseRaw = async () => {
    if (!rawText.trim()) return;
    setParsing(true);
    try {
      const parsed = await parseRawInvoiceText(rawText);
      setInvoiceNumber(parsed.invoiceNumber);
      setInvoiceDate(parsed.invoiceDate);
      setVendorName(parsed.vendorName);
      setVendorIsMdecTsp(parsed.vendorIsMdecTsp);
      if (parsed.items.length > 0) {
        setItemDesc(parsed.items[0].description);
        setItemCategory(parsed.items[0].category);
      }
      setItemAmount(parsed.totalAmountMYR);
    } finally {
      setParsing(false);
    }
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const customInvoice: Invoice = {
        invoiceNumber: invoiceNumber.trim() || "INV-2026-9901",
        invoiceDate: invoiceDate || "2026-10-22",
        vendorName: vendorName.trim() || "CloudTech Malaysia Sdn Bhd",
        vendorIsMdecTsp,
        totalAmountMYR: Number(itemAmount) || 6000,
        items: [
          {
            id: "item-custom-1",
            description: itemDesc.trim() || "Qualifying Expenditure Line Item",
            category: itemCategory,
            quantity: 1,
            unitPriceMYR: Number(itemAmount) || 6000,
            totalPriceMYR: Number(itemAmount) || 6000,
          },
        ],
      };
      await runNewInvoiceTrigger(customInvoice);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="inv-trigger-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-xl">
        <div className="flex items-start justify-between border-b border-rule px-6 py-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-sm bg-accent-soft px-2 py-0.5 text-small font-semibold text-accent">
              <FilePlus2 size={13} />
              <span>EVENT TRIGGER #2 • NEW INVOICE SUBMISSION</span>
            </div>
            <h2 id="inv-trigger-title" className="mt-1.5 text-section font-semibold text-ink">
              Submit New Expenditure Invoice Trigger
            </h2>
            <p className="text-small text-muted">
              Submitting a new invoice persists it to Neon Postgres and immediately triggers deterministic eligibility scoring across all 7 Malaysian grants.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted hover:bg-active hover:text-ink cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto p-6 flex flex-col gap-5">
          {/* 1-Click Presets */}
          <div>
            <h3 className="text-small font-semibold text-ink mb-2">
              1-Click Expenditure Trigger Presets
            </h3>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {PRESET_INVOICES.map((p) => (
                <button
                  key={p.invoice.invoiceNumber}
                  type="button"
                  disabled={busy}
                  onClick={() => void handleTriggerPreset(p.invoice)}
                  className="flex flex-col justify-between rounded-[var(--radius-control)] border border-line bg-raised/40 p-3 text-left hover:border-accent hover:bg-accent-soft/20 cursor-pointer transition-colors"
                >
                  <div>
                    <span className="inline-block rounded-sm bg-surface px-1.5 py-0.5 text-[11px] font-medium text-accent border border-line">
                      {p.badge}
                    </span>
                    <p className="mt-1.5 text-body font-semibold text-ink">{p.label}</p>
                  </div>
                  <p className="mt-2 text-small text-muted num">
                    {p.invoice.invoiceNumber} · <strong>{formatMYR(p.invoice.totalAmountMYR)}</strong>
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Optional OCR / Raw Text Parse */}
          <div className="border-t border-rule pt-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-small font-semibold text-ink">
                Optional: Paste Raw / OCR Invoice Text (DeepSeek Parser)
              </label>
              <button
                type="button"
                disabled={parsing || !rawText.trim()}
                onClick={() => void handleParseRaw()}
                className="inline-flex h-7 items-center gap-1 rounded-[var(--radius-control)] border border-control bg-surface px-2.5 text-small font-medium hover:bg-active cursor-pointer disabled:opacity-50"
              >
                <Sparkles size={12} />
                <span>{parsing ? "Parsing..." : "Extract Fields"}</span>
              </button>
            </div>
            <textarea
              rows={2}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste messy invoice text (e.g. TAX INVOICE CloudTech Malaysia Sdn Bhd MDEC TSP #0421 RM 6,000.00 LHDN MyInvois...)"
              className="w-full rounded-[var(--radius-control)] border border-control bg-surface p-2.5 text-small"
            />
          </div>

          {/* Custom Invoice Form */}
          <form onSubmit={(e) => void handleCustomSubmit(e)} className="border-t border-rule pt-4 flex flex-col gap-3.5">
            <h3 className="text-small font-semibold text-ink">Custom Invoice Details</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-small text-muted mb-1">Invoice Number</label>
                <input
                  type="text"
                  required
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="h-9 w-full rounded-[var(--radius-control)] border border-control bg-surface px-3 text-body num"
                />
              </div>
              <div>
                <label className="block text-small text-muted mb-1">Vendor Name</label>
                <input
                  type="text"
                  required
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  className="h-9 w-full rounded-[var(--radius-control)] border border-control bg-surface px-3 text-body"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-small text-muted mb-1">Expenditure Category</label>
                <select
                  value={itemCategory}
                  onChange={(e) =>
                    setItemCategory(e.target.value as InvoiceLineItem["category"])
                  }
                  className="h-9 w-full rounded-[var(--radius-control)] border border-control bg-surface px-3 text-body"
                >
                  <option value="E_INVOICING">E_INVOICING (MDEC)</option>
                  <option value="DIGITAL_ERP">DIGITAL_ERP (MDEC/MITI/Cradle)</option>
                  <option value="HR_PAYROLL">HR_PAYROLL (MDEC/HRD Corp)</option>
                  <option value="AUTOMATION_HARDWARE">AUTOMATION_HARDWARE (SME Corp/MIDA/MITI)</option>
                  <option value="EXPORT_EXHIBITION">EXPORT_EXHIBITION (MATRADE)</option>
                </select>
              </div>
              <div>
                <label className="block text-small text-muted mb-1">Total Amount (MYR)</label>
                <input
                  type="number"
                  min={100}
                  step={500}
                  required
                  value={itemAmount}
                  onChange={(e) => setItemAmount(Number(e.target.value))}
                  className="h-9 w-full rounded-[var(--radius-control)] border border-control bg-surface px-3 text-body num"
                />
              </div>
              <div>
                <label className="block text-small text-muted mb-1">Line Item Description</label>
                <input
                  type="text"
                  required
                  value={itemDesc}
                  onChange={(e) => setItemDesc(e.target.value)}
                  className="h-9 w-full rounded-[var(--radius-control)] border border-control bg-surface px-3 text-body"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-body cursor-pointer">
              <input
                type="checkbox"
                checked={vendorIsMdecTsp}
                onChange={(e) => setVendorIsMdecTsp(e.target.checked)}
                className="size-4 accent-ink"
              />
              <span>Vendor is an Accredited MDEC Technology Solution Provider (TSP)</span>
            </label>

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
                {busy ? "Evaluating 7 Grants..." : "Submit Invoice & Trigger Evaluation"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
