/**
 * Re-mounts on every navigation, so each page eases in (a short fade and rise) instead of snapping.
 * The animation uses only opacity and transform, and is reduced to an instant swap for users who prefer less motion.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="anim-page">{children}</div>;
}
