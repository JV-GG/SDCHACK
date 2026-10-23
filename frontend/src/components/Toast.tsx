"use client";

import { CheckCircle2, Info, AlertTriangle, X } from "lucide-react";

export interface ToastMessage {
  id: string;
  title: string;
  message?: string;
  tone?: "positive" | "info" | "warning";
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <aside
      aria-label="Notifications"
      className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2.5 max-w-lg w-[calc(100vw-32px)] pointer-events-none"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className="pointer-events-auto flex items-start gap-3.5 rounded-xl border border-slate-700/80 bg-[#0f172a] text-white p-4 shadow-2xl ring-1 ring-white/10 anim-toast backdrop-blur-md"
        >
          {t.tone === "positive" || !t.tone ? (
            <div className="flex-none rounded-full bg-emerald-500/20 p-1.5 text-emerald-400 ring-1 ring-emerald-500/40">
              <CheckCircle2 size={20} strokeWidth={2} aria-hidden="true" />
            </div>
          ) : t.tone === "warning" ? (
            <div className="flex-none rounded-full bg-amber-500/20 p-1.5 text-amber-400 ring-1 ring-amber-500/40">
              <AlertTriangle size={20} strokeWidth={2} aria-hidden="true" />
            </div>
          ) : (
            <div className="flex-none rounded-full bg-cyan-500/20 p-1.5 text-cyan-400 ring-1 ring-cyan-500/40">
              <Info size={20} strokeWidth={2} aria-hidden="true" />
            </div>
          )}

          <div className="flex-1 min-w-0 pt-0.5">
            <p className="text-[14px] font-semibold text-white tracking-tight">{t.title}</p>
            {t.message && <p className="mt-1 text-[13px] text-slate-300 leading-snug">{t.message}</p>}
          </div>

          <button
            type="button"
            onClick={() => onDismiss(t.id)}
            aria-label="Dismiss notification"
            className="-mr-1 -mt-1 p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ))}
    </aside>
  );
}
