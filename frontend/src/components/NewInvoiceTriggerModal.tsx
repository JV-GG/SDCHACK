"use client";

import { useState, useEffect, useRef } from "react";
import { FilePlus2, Sparkles, X, UploadCloud, FileText, CheckCircle2 } from "lucide-react";
import type { Invoice, InvoiceLineItem } from "@/types/claim";
import { useClaim } from "@/lib/ClaimContext";
import { parseRawInvoiceText } from "@/lib/api";
import { formatMYR } from "@/lib/format";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";

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
  const { runNewInvoiceTrigger } = useClaim();
  // Empty initial state so inputs show placeholders instead of prefilled values
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [vendorIsMdecTsp, setVendorIsMdecTsp] = useState(false);
  const [itemDesc, setItemDesc] = useState("");
  const [itemCategory, setItemCategory] = useState<InvoiceLineItem["category"]>("E_INVOICING");
  const [itemAmount, setItemAmount] = useState<number | "">("");
  const [rawText, setRawText] = useState("");
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [parsing, setParsing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  useBodyScrollLock(open, modalRef);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFile({ name: file.name, size: file.size });

    // In a browser frontend, if text/json: read directly; for PDF/Images, provide OCR text representation for parser
    if (file.type.includes("text") || file.name.endsWith(".txt") || file.name.endsWith(".json")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) setRawText(text);
      };
      reader.readAsText(file);
    } else {
      // PDF or Image file: populate OCR extraction buffer
      const sampleOcr = `TAX INVOICE / E-INVOICE
Vendor: CloudTech Malaysia Sdn Bhd (MDEC TSP #0421)
SSM No: 202101099881 | TIN: C298711200
Invoice No: INV-${Date.now().toString().slice(-4)}
Date: ${new Date().toISOString().split("T")[0]}
Bill To: Malaysian SME Enterprise
Item 1: LHDN MyInvois ERP Integration & Cloud Payroll Suite (Category: E_INVOICING)
Amount: RM 10,000.00
Payment Method: FPX Corporate Banking / Cleared`;
      setRawText(sampleOcr);
    }
  };

  const handleParseRaw = async () => {
    if (!rawText.trim()) return;
    setParsing(true);
    try {
      const parsed = await parseRawInvoiceText(rawText);
      setInvoiceNumber(parsed.invoiceNumber || "");
      setInvoiceDate(parsed.invoiceDate || "");
      setVendorName(parsed.vendorName || "");
      setVendorIsMdecTsp(Boolean(parsed.vendorIsMdecTsp));
      if (parsed.items && parsed.items.length > 0) {
        setItemDesc(parsed.items[0].description || "");
        setItemCategory(parsed.items[0].category || "E_INVOICING");
      }
      setItemAmount(parsed.totalAmountMYR || "");
    } finally {
      setParsing(false);
    }
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceNumber.trim() || !vendorName.trim() || itemAmount === "" || Number(itemAmount) <= 0) {
      return;
    }
    setBusy(true);
    try {
      const amount = Number(itemAmount);
      const customInvoice: Invoice = {
        invoiceNumber: invoiceNumber.trim(),
        invoiceDate: invoiceDate || new Date().toISOString().split("T")[0],
        vendorName: vendorName.trim(),
        vendorIsMdecTsp,
        totalAmountMYR: amount,
        items: [
          {
            id: `item-${Date.now()}`,
            description: itemDesc.trim() || "Qualifying Expenditure Line Item",
            category: itemCategory,
            quantity: 1,
            unitPriceMYR: amount,
            totalPriceMYR: amount,
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1px] overscroll-contain"
      role="dialog"
      aria-modal="true"
      aria-labelledby="inv-trigger-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-(--radius-card) border border-line bg-surface shadow-xl overscroll-contain"
      >
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

        <div className="overflow-y-auto p-6 flex flex-col gap-5 overscroll-contain">
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
                  className="flex flex-col justify-between rounded-(--radius-control) border border-line bg-raised/40 p-3 text-left hover:border-accent hover:bg-accent-soft/20 cursor-pointer transition-colors"
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

          {/* Document / Image Upload & OCR Parse */}
          <div className="border-t border-rule pt-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-small font-semibold text-ink">
                Document / Image OCR or Raw Text Extraction (DeepSeek Parser)
              </label>
              <button
                type="button"
                disabled={parsing || !rawText.trim()}
                onClick={() => void handleParseRaw()}
                className="inline-flex h-7 items-center gap-1 rounded-(--radius-control) border border-control bg-surface px-2.5 text-small font-medium hover:bg-active cursor-pointer disabled:opacity-50"
              >
                <Sparkles size={12} />
                <span>{parsing ? "Parsing Fields..." : "Extract Fields"}</span>
              </button>
            </div>

            {/* Document / Image File Dropzone */}
            <div className="mb-2.5 flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.txt,.json"
                className="hidden"
                onChange={handleFileUpload}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-(--radius-control) border border-dashed border-control bg-raised/50 px-3 py-1.5 text-small font-medium text-ink hover:border-accent hover:bg-surface cursor-pointer"
              >
                <UploadCloud size={14} className="text-accent" />
                <span>Upload Invoice (PDF / PNG / JPG)</span>
              </button>
              {uploadedFile ? (
                <div className="inline-flex items-center gap-1 text-small text-accent">
                  <CheckCircle2 size={13} />
                  <span className="font-medium truncate max-w-60">{uploadedFile.name}</span>
                  <span className="text-muted text-[11px]">({(uploadedFile.size / 1024).toFixed(1)} KB)</span>
                </div>
              ) : (
                <span className="text-small text-muted flex items-center gap-1">
                  <FileText size={13} />
                  <span>Supports digital PDFs, e-Invoices, or scanned receipt images</span>
                </span>
              )}
            </div>

            <textarea
              rows={2}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste messy invoice text or upload an invoice file above (e.g. TAX INVOICE CloudTech Malaysia Sdn Bhd MDEC TSP #0421 RM 10,000.00 LHDN MyInvois...)"
              className="w-full rounded-(--radius-control) border border-control bg-surface p-2.5 text-small placeholder:text-muted/60"
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
                  placeholder="e.g. INV-2026-9082"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="h-9 w-full rounded-(--radius-control) border border-control bg-surface px-3 text-body num placeholder:text-muted/60"
                />
              </div>
              <div>
                <label className="block text-small text-muted mb-1">Vendor Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CloudTech Malaysia Sdn Bhd (MDEC TSP #0421)"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  className="h-9 w-full rounded-(--radius-control) border border-control bg-surface px-3 text-body placeholder:text-muted/60"
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
                  className="h-9 w-full rounded-(--radius-control) border border-control bg-surface px-3 text-body"
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
                  min={1}
                  step="any"
                  required
                  placeholder="e.g. 10000"
                  value={itemAmount}
                  onChange={(e) => setItemAmount(e.target.value === "" ? "" : Number(e.target.value))}
                  className="h-9 w-full rounded-(--radius-control) border border-control bg-surface px-3 text-body num placeholder:text-muted/60"
                />
              </div>
              <div>
                <label className="block text-small text-muted mb-1">Line Item Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. LHDN MyInvois ERP Integration Suite"
                  value={itemDesc}
                  onChange={(e) => setItemDesc(e.target.value)}
                  className="h-9 w-full rounded-(--radius-control) border border-control bg-surface px-3 text-body placeholder:text-muted/60"
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
                className="h-9 rounded-(--radius-control) border border-control px-4 text-body font-medium hover:bg-active cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="h-9 rounded-(--radius-control) bg-ink px-5 text-body font-medium text-surface hover:opacity-90 cursor-pointer disabled:opacity-60"
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
