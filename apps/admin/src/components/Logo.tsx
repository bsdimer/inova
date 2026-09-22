/**
 * The lockup is monochrome on glass: the photograph behind it supplies the
 * colour, and a tinted mark would fight it. Both parts take `currentColor`.
 */
export function InovaWordmark({ size = 24 }: { size?: number }) {
  return (
    <span className="inline-flex flex-col" aria-label="inova, by WhiteNova Technology">
      <span
        className="font-medium leading-none"
        style={{ fontSize: size, letterSpacing: size * 0.22 }}
      >
        inova
      </span>
      <span className="mt-1.5 flex items-center gap-1.5">
        <span className="h-px flex-1 bg-current opacity-70" />
        <span className="h-1 w-1 rounded-full bg-current" />
      </span>
      <span
        className="mt-1.5 font-semibold uppercase opacity-55"
        style={{ fontSize: Math.max(6, size * 0.26), letterSpacing: size * 0.05 }}
      >
        by WhiteNova Technology
      </span>
    </span>
  );
}

/** Square mark for a tight row, e.g. an organization tile. */
export function InovaMark({ size = 40 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="flex items-center justify-center rounded-[30%] font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.5,
        background: 'var(--glass-avatar)',
        boxShadow: 'inset 0 0 0 1px var(--glass-avatar-edge)',
      }}
    >
      i
    </span>
  );
}
