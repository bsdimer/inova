import { Home } from 'lucide-react';

interface MarkProps {
  size?: number;
  disc?: string;
  icon?: string;
}

/** Circular gradient-ring mark echoing the brand lockup. */
export function SosedoMark({ size = 56, disc = '#0F1D3A', icon = '#FFFFFF' }: MarkProps) {
  const ring = Math.max(3, size * 0.055);
  return (
    <div
      className="flex items-center justify-center rounded-full bg-gradient-to-br from-brand-blue to-brand-green"
      style={{ width: size, height: size }}
    >
      <div
        className="relative flex items-center justify-center rounded-full"
        style={{ width: size - ring * 2, height: size - ring * 2, backgroundColor: disc }}
      >
        <Home size={size * 0.4} color={icon} strokeWidth={2.4} />
        <span
          className="absolute rounded-full bg-brand-green"
          style={{
            width: size * 0.1,
            height: size * 0.1,
            top: size * 0.14,
            right: size * 0.16,
          }}
        />
      </div>
    </div>
  );
}

/** "SOSEDO" wordmark — the E carries the brand green. */
export function SosedoWordmark({
  size = 28,
  color = '#FFFFFF',
}: {
  size?: number;
  color?: string;
}) {
  return (
    <span className="font-extrabold" style={{ fontSize: size, letterSpacing: size * 0.14, color }}>
      SOS<span className="text-brand-green">E</span>DO
    </span>
  );
}
