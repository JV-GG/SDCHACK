import { Skeleton, SkeletonCard, SkeletonRegion, SkeletonText } from "@/components/Skeleton";

/** Title block shared by every page: breadcrumb line, h1, intro paragraph. */
function TitleBlock({ intro = 2 }: { intro?: number }) {
  return (
    <div aria-hidden="true" className="min-w-0 flex-1">
      <Skeleton className="h-4 w-56" />
      <Skeleton className="mt-2 h-7 w-44" />
      <SkeletonText lines={intro} className="mt-2 max-w-[68ch]" lineClassName="h-5" />
    </div>
  );
}

/** A KPI strip: one container split by 1px dividers, like the real DashboardStats / submitted summary. */
function StatStrip({ cells, className, lead = false }: { cells: number; className: string; lead?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`grid gap-px overflow-hidden rounded-(--radius-card) border border-line bg-line ${className}`}
    >
      {Array.from({ length: cells }, (_, i) => (
        <div key={i} className={`bg-surface p-4 ${lead && i === 0 ? "col-span-2 lg:col-span-1" : ""}`}>
          <Skeleton className="h-5 w-28" />
          <Skeleton className={`mt-1 ${lead && i === 0 ? "h-9 w-40" : "h-7 w-24"}`} />
          <Skeleton className="mt-1 h-4 w-3/4" />
        </div>
      ))}
    </div>
  );
}

/** One grant card: agency chip, name, amount, bar, footer. Same padding and rhythm as GrantMatrixCard. */
export function GrantCardSkeleton() {
  return (
    <SkeletonCard>
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="mt-2 h-6 w-3/4 max-w-96" />
          <Skeleton className="mt-1 h-5 w-2/3 max-w-80" />
        </div>
        <div className="flex flex-none flex-col items-start gap-2 sm:items-end">
          <Skeleton className="h-5 w-28 rounded-full" />
          <Skeleton className="h-7 w-28" />
        </div>
      </div>
      <div className="px-5 pb-4">
        <Skeleton className="h-2 w-full rounded-full" />
        <div className="mt-1.5 flex justify-between gap-3">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-rule px-5 py-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-8 w-36" />
      </div>
    </SkeletonCard>
  );
}

/** Rows for a list inside a card (timeline entries, recent claims, activity). */
export function ListRowsSkeleton({ rows = 4, className = "" }: { rows?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={`flex flex-col ${className}`}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="border-t border-rule py-3 first:border-t-0 first:pt-0">
          <Skeleton className="h-5 w-4/5" />
          <Skeleton className="mt-1.5 h-4 w-2/5" />
        </div>
      ))}
    </div>
  );
}

function SideCard({ rows = 4 }: { rows?: number }) {
  return (
    <SkeletonCard className="p-5">
      <Skeleton className="h-6 w-40" />
      <div className="mt-3 flex flex-col gap-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-baseline justify-between gap-4">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-5 w-20" />
          </div>
        ))}
      </div>
    </SkeletonCard>
  );
}

/** Grant Hub while the first claim is evaluated. */
export function GrantHubSkeleton() {
  return (
    <SkeletonRegion label="Loading Grant Hub…" className="px-4 py-6 md:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <TitleBlock />
        <div aria-hidden="true" className="flex flex-none items-center gap-2">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>
      <div className="mt-6 flex flex-col gap-6">
        <StatStrip lead cells={5} className="grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]" />
        <SkeletonCard className="p-5">
          <div className="flex items-center justify-between gap-3 border-b border-rule pb-3">
            <div>
              <Skeleton className="h-6 w-40" />
              <Skeleton className="mt-1 h-4 w-72 max-w-full" />
            </div>
            <Skeleton className="hidden h-8 w-56 sm:block" />
          </div>
          <div className="mt-4 grid gap-5 lg:grid-cols-5 lg:gap-4">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i}>
                <Skeleton className="mb-3 size-3 rounded-full" />
                <Skeleton className="h-5 w-24" />
                <SkeletonText lines={2} className="mt-1.5" lineClassName="h-4" />
              </div>
            ))}
          </div>
        </SkeletonCard>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div aria-hidden="true" className="flex flex-col gap-4">
            <Skeleton className="h-6 w-56" />
            <GrantCardSkeleton />
            <GrantCardSkeleton />
          </div>
          <div aria-hidden="true" className="flex flex-col gap-6">
            <SideCard rows={4} />
            <SkeletonCard className="p-5">
              <Skeleton className="h-6 w-36" />
              <ListRowsSkeleton rows={3} className="mt-3" />
            </SkeletonCard>
          </div>
        </div>
      </div>
    </SkeletonRegion>
  );
}

/** Connected data while the organisation loads. */
export function ConnectedDataSkeleton() {
  return (
    <SkeletonRegion label="Loading connected data…" className="px-4 py-6 md:px-6">
      <Skeleton className="h-7 w-44" />
      <SkeletonText lines={2} className="mt-2 max-w-[72ch]" lineClassName="h-5" />
      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-2">
        <div aria-hidden="true" className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-2">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-4 w-56" />
          </div>
          {[6, 1, 2].map((rows, i) => (
            <SkeletonCard key={i} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Skeleton className="h-6 w-44" />
                  <Skeleton className="mt-1 h-4 w-56" />
                </div>
                <Skeleton className="h-8 w-16" />
              </div>
              <div className="mt-3 flex flex-col">
                {Array.from({ length: rows }, (_, r) => (
                  <div key={r} className="border-t border-rule py-2 first:border-t-0">
                    <div className="flex items-baseline justify-between gap-4">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-5 w-28" />
                    </div>
                    <Skeleton className="mt-1 h-4 w-3/4" />
                  </div>
                ))}
              </div>
            </SkeletonCard>
          ))}
        </div>
        <div aria-hidden="true" className="flex flex-col gap-6">
          <SkeletonCard className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Skeleton className="h-6 w-40" />
                <Skeleton className="mt-1 h-5 w-64 max-w-full" />
              </div>
              <Skeleton className="h-8 w-40" />
            </div>
            <div className="mt-4 rounded-(--radius-control) bg-raised p-4">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="mt-1 h-4 w-1/2" />
              <div className="mt-4 flex flex-col gap-3">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
              </div>
            </div>
          </SkeletonCard>
          <SkeletonCard className="p-5">
            <Skeleton className="h-6 w-36" />
            <ListRowsSkeleton rows={3} className="mt-3" />
          </SkeletonCard>
        </div>
      </div>
    </SkeletonRegion>
  );
}

/** Audit trail while the claim and its history load. */
export function AuditSkeleton() {
  return (
    <SkeletonRegion label="Loading audit trail…" className="px-4 py-6 md:px-6">
      <Skeleton className="h-7 w-36" />
      <Skeleton className="mt-2 h-6 w-[min(32rem,100%)]" />
      <div aria-hidden="true" className="mt-4 flex gap-4 border-b border-line">
        <Skeleton className="mb-3 h-5 w-20" />
        <Skeleton className="mb-3 h-5 w-40" />
      </div>
      <div className="mt-6">
        <AuditClaimSkeleton />
      </div>
    </SkeletonRegion>
  );
}

/** Timeline and summary rail, for when the claim picker is already on screen and only the claim is loading. */
export function AuditClaimBodySkeleton() {
  return (
    <SkeletonRegion label="Loading claim…">
      <div
        aria-hidden="true"
        className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]"
      >
        <SkeletonCard className="p-5">
          <ListRowsSkeleton rows={6} />
        </SkeletonCard>
        <div className="flex flex-col gap-6">
          <SideCard rows={4} />
          <SideCard rows={3} />
        </div>
      </div>
    </SkeletonRegion>
  );
}

/** The claim picker, timeline and summary rail. */
export function AuditClaimSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="mb-4">
        <Skeleton className="mb-1 h-4 w-20" />
        <Skeleton className="h-8 w-full max-w-160" />
      </div>
      <AuditClaimBodySkeleton />
    </div>
  );
}

/** Submitted grants while the claim records load. */
export function SubmittedSkeleton() {
  return (
    <SkeletonRegion label="Loading submitted grants…" className="px-4 py-6 md:px-6">
      <TitleBlock />
      <div className="mt-6">
        <StatStrip cells={4} className="grid-cols-2 sm:grid-cols-4" />
      </div>
      <div aria-hidden="true" className="mt-6 flex flex-col gap-4">
        {[0, 1].map((i) => (
          <SkeletonCard key={i} className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="mt-2 h-6 w-3/5" />
                <Skeleton className="mt-1 h-5 w-2/5" />
              </div>
              <Skeleton className="h-8 w-24" />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          </SkeletonCard>
        ))}
      </div>
    </SkeletonRegion>
  );
}
