// NanFeng 南风 logo · concept 9 "Sail": a reduced sail over Pacific waves.
// Redrawn as SVG from the concept sheet so it stays sharp at any size and follows the theme
// (colors come from the --logo-* tokens in globals.css).

export function SailMark({ size = 32, title }: { size?: number; title?: string }) {
  return (
    <svg
      className="sail-mark"
      width={size}
      height={(size * 560) / 600}
      viewBox="20 20 600 560"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <path d="M422,32 C505,120 568,235 586,364 C497,370 410,378 322,388 Z" fill="var(--logo-sail)" />
      <path d="M380,126 C322,236 250,326 166,388 L290,384 Z" fill="var(--logo-jib)" />
      <path d="M30,518 C92,436 190,398 300,398 C392,398 458,414 508,422 C462,448 392,466 300,458 C205,450 118,460 30,518 Z" fill="var(--logo-wave)" />
      <path d="M92,518 C190,474 292,498 398,480 C482,466 546,430 597,394 C568,478 492,557 390,574 C285,590 185,532 92,518 Z" fill="var(--logo-red)" />
    </svg>
  );
}

/** Symbol + wordmark. `stacked` puts 南风 under NanFeng, as in the concept lockup. */
export function Logo({ size = 28, stacked = true }: { size?: number; stacked?: boolean }) {
  return (
    <span className="logo" style={{ gap: size * 0.32 }}>
      <SailMark size={size * 1.15} />
      <span className={`logo-word${stacked ? " stacked" : ""}`} style={{ fontSize: size * (stacked ? 0.62 : 0.6) }}>
        <span className="logo-latin">NanFeng</span>
        <span className="logo-han" lang="zh-CN">南风</span>
      </span>
    </span>
  );
}
