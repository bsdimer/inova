interface MarkProps {
  size?: number;
  disc?: string;
  icon?: string;
}

/** Compact inova mark for places where the full lockup does not fit. */
export function InovaMark({ size = 56, disc = '#1D1D1F', icon = '#FFFFFF' }: MarkProps) {
  const ring = Math.max(3, size * 0.055);
  return (
    <div
      className="flex items-center justify-center rounded-[32%] bg-gradient-to-br from-orange-bright to-orange shadow-lg shadow-orange/20"
      style={{ width: size, height: size }}
    >
      <div
        className="relative flex items-center justify-center rounded-[27%]"
        style={{ width: size - ring * 2, height: size - ring * 2, backgroundColor: disc }}
      >
        <span
          className="font-black leading-none"
          style={{
            color: icon,
            fontSize: size * 0.55,
            transform: `translateY(${size * -0.015}px)`,
          }}
        >
          i
        </span>
      </div>
    </div>
  );
}

/** Lowercase inova wordmark. */
export function InovaWordmark({
  size = 28,
  color = 'currentColor',
}: {
  size?: number;
  color?: string;
}) {
  return (
    <span className="inline-flex flex-col" style={{ color }}>
      <span
        className="font-medium leading-none"
        style={{ fontSize: size, letterSpacing: size * 0.22 }}
      >
        inova
      </span>
      <span className="mt-1 flex items-center gap-1.5">
        <span className="h-px flex-1 bg-orange" />
        <span className="h-1 w-1 rounded-full bg-orange" />
      </span>
      <span
        className="mt-1 font-semibold uppercase opacity-60"
        style={{ fontSize: Math.max(6, size * 0.28), letterSpacing: size * 0.055 }}
      >
        by WhiteNova Technology
      </span>
    </span>
  );
}
