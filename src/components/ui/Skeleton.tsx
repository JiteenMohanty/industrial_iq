/**
 * The one remaining loading placeholder, used by the filter bar's Suspense fallback in the root
 * layout. It is a fixed, small height that matches the real control row, so swapping between them
 * does not change the document height.
 *
 * There is deliberately no page-level skeleton and no `loading.tsx` on any route — see the note in
 * `tests/ui/scroll-behaviour.spec.ts`. A full-page skeleton is roughly a third the height of the
 * content it stands in for, so showing one on a same-route parameter change collapsed the document
 * and made the browser clamp the reader's scroll position to near the top. At a 16-160 ms server
 * response the fallback bought nothing and cost the reader their place on every interaction.
 */
export function Skeleton({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`animate-pulse rounded bg-raised ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}
