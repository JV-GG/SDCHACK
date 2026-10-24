import { Skeleton, SkeletonCard, SkeletonRegion, SkeletonText } from "@/components/Skeleton";

/** Rows for a list inside a card (timeline entries, invoices, activity). */
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

/** A summary strip: one container split by 1px dividers, like the My claims summary. */
function StatStrip({ cells }: { cells: number }) {
  return (
    <div
      aria-hidden="true"
      className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-px overflow-hidden rounded-xl border border-line bg-line"
    >
      {Array.from({ length: cells }, (_, i) => (
        <div key={i} className="bg-surface px-5 py-4.5">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="mt-1 h-8 w-32" />
        </div>
      ))}
    </div>
  );
}

/** Home while the first claim is evaluated: headline, actions, progress, two grant cards. */
export function GrantHubSkeleton() {
  return (
    <SkeletonRegion label="Loading Home…" className="px-4 py-10 md:px-10">
      <div aria-hidden="true" className="mx-auto flex max-w-400 flex-col gap-10">
        <div className="flex flex-col gap-5">
          <Skeleton className="h-5 w-72 max-w-full" />
          <Skeleton className="h-12 w-[min(28rem,100%)]" />
          <SkeletonText lines={2} className="max-w-[56ch]" lineClassName="h-6" />
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-12 w-48" />
            <Skeleton className="h-12 w-52" />
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col gap-2">
                <Skeleton className="h-1.5 rounded-full" />
                <Skeleton className="h-5 w-32" />
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3.5">
          <Skeleton className="h-7 w-36" />
          <div className="grid gap-3.5 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <SkeletonCard key={i} className="flex flex-col gap-3 rounded-xl p-5">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-11 w-full" />
              </SkeletonCard>
            ))}
          </div>
        </div>
      </div>
    </SkeletonRegion>
  );
}

/** My company while the organisation loads: three detail sections beside the invoices. */
export function ConnectedDataSkeleton() {
  return (
    <SkeletonRegion label="Loading My company…" className="px-4 py-10 md:px-10">
      <div aria-hidden="true" className="mx-auto flex max-w-400 flex-col gap-7">
        <div>
          <Skeleton className="h-9 w-72 max-w-full" />
          <Skeleton className="mt-2 h-6 w-[min(32rem,100%)]" />
        </div>
        <div className="flex flex-wrap items-start gap-6">
          <div className="flex min-w-0 flex-[999_1_460px] flex-col gap-4">
            {[4, 1, 2].map((tiles, i) => (
              <SkeletonCard key={i} className="overflow-hidden rounded-[14px]">
                <div className="flex items-center justify-between gap-3 bg-raised py-3 pl-5 pr-3">
                  <div>
                    <Skeleton className="h-6 w-44" />
                    <Skeleton className="mt-1 h-4 w-56" />
                  </div>
                  <Skeleton className="h-10 w-16" />
                </div>
                <div className="-mb-px -mr-px grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
                  {Array.from({ length: tiles }, (_, t) => (
                    <div key={t} className="border-b border-r border-rule bg-surface px-5 py-4">
                      <Skeleton className="h-5 w-28" />
                      <Skeleton className="mt-1 h-6 w-36" />
                    </div>
                  ))}
                </div>
              </SkeletonCard>
            ))}
          </div>
          <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-6">
            <div>
              <Skeleton className="h-7 w-32" />
              <SkeletonCard className="mt-2.5 rounded-xl p-4">
                <ListRowsSkeleton rows={2} />
              </SkeletonCard>
            </div>
            <Skeleton className="h-24 rounded-xl" />
          </div>
        </div>
      </div>
    </SkeletonRegion>
  );
}

/** One invoice's story card, for when the picker is on screen and only the claim is loading. */
export function AuditClaimBodySkeleton() {
  return (
    <SkeletonRegion label="Loading invoice history…">
      <SkeletonCard className="rounded-[14px] p-6">
        <div aria-hidden="true">
          <div className="flex items-baseline justify-between gap-2">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-5 w-36" />
          </div>
          <div className="mt-5 flex flex-col gap-4">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex gap-3.5">
                <Skeleton className="size-7 flex-none rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-6 w-3/5" />
                  <Skeleton className="mt-1 h-4 w-36" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </SkeletonCard>
    </SkeletonRegion>
  );
}

/** History while the claim and its records load. */
export function AuditSkeleton() {
  return (
    <SkeletonRegion label="Loading History…" className="px-4 py-10 md:px-10">
      <div className="mx-auto flex max-w-400 flex-col gap-6">
        <div aria-hidden="true" className="flex items-center justify-between gap-3">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-40 rounded-full" />
        </div>
        <AuditClaimBodySkeleton />
        <Skeleton className="h-24 rounded-[14px]" />
      </div>
    </SkeletonRegion>
  );
}

/** My claims while the sent claims load. */
export function SubmittedSkeleton() {
  return (
    <SkeletonRegion label="Loading My claims…" className="px-4 py-10 md:px-10">
      <div className="mx-auto flex max-w-400 flex-col gap-7">
        <Skeleton className="h-9 w-40" />
        <StatStrip cells={3} />
        <div aria-hidden="true" className="grid items-start gap-4 xl:grid-cols-2">
          {[0, 1].map((i) => (
            <SkeletonCard key={i} className="flex flex-col gap-5 rounded-[14px] p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="mt-2 h-7 w-3/5" />
                </div>
                <Skeleton className="h-8 w-28" />
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[0, 1, 2, 3].map((s) => (
                  <Skeleton key={s} className="h-2 rounded-full" />
                ))}
              </div>
              <Skeleton className="h-12 rounded-[10px]" />
            </SkeletonCard>
          ))}
        </div>
      </div>
    </SkeletonRegion>
  );
}
