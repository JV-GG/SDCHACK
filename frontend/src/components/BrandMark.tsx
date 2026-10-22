/** The product mark: a tick inside a claim form, drawn in the accent. */
export function BrandMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="flex-none">
      <rect width="24" height="24" rx="6" fill="var(--accent)" />
      <path d="M7 4.5h7l3.5 3.5v11a1 1 0 0 1-1 1h-9.5a1 1 0 0 1-1-1v-13.5a1 1 0 0 1 1-1Z" fill="#fff" />
      <path d="M9 13.2l2.1 2.1 3.9-4.1" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
