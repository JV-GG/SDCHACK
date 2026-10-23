/**
 * The SME GrantFlow mark: a "G" whose bar is an arrow pointing forward, for grants flowing to the business.
 * The same artwork lives in src/app/icon.svg (browser tab) with the accent colour written out.
 */
export function BrandMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="flex-none">
      <rect width="24" height="24" rx="6" fill="var(--accent)" />
      <path d="M16.6 7.3A6 6 0 1 0 17.2 15.4" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      <path
        d="M11.8 12H19.6M17.2 9.6 19.6 12l-2.4 2.4"
        fill="none"
        stroke="#fff"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
