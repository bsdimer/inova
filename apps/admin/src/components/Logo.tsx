/**
 * Logo/Wordmark (Figma 9:25): «inova», a rule ending in a dot, and the byline,
 * 4 apart. Letter-spacing is 22 % of the size; the byline is 28 % of it with
 * 5.5 % tracking. On glass the screens draw every part in `currentColor` — the
 * photograph behind supplies the colour, and the brand-orange rule of the
 * master component would fight it.
 */
export function InovaWordmark({ size = 22 }: { size?: number }) {
  return (
    <span className="inline-flex flex-col gap-1" aria-label="inova, by WhiteNova Technology">
      <span
        className="font-medium"
        style={{ fontSize: size, lineHeight: `${size}px`, letterSpacing: size * 0.22 }}
      >
        inova
      </span>
      <span className="flex items-center gap-1.5" aria-hidden>
        <span className="h-px flex-1 bg-current" />
        <span className="h-1 w-1 rounded-full bg-current" />
      </span>
      <span
        className="font-semibold uppercase"
        style={{
          fontSize: size * 0.28,
          // 7.392 in Figma; the frame rounds the lockup up to a whole 42.
          lineHeight: `${Math.ceil(size * 0.336)}px`,
          letterSpacing: size * 0.055,
        }}
        aria-hidden
      >
        by WhiteNova Technology
      </span>
    </span>
  );
}
