"use client";

/** Shown when the first load fails. Shared by every page so the retry looks and behaves the same. */
export function BackendError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="anim-fade flex flex-col items-center justify-center p-12 text-center">
      <p className="mb-3 text-body font-medium text-negative">Backend Error: {message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-(--radius-control) bg-ink px-4 py-2 text-body font-medium text-surface cursor-pointer"
      >
        Retry Connection
      </button>
    </div>
  );
}
