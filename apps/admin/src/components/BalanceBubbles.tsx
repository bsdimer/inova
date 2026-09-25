import type { ReactNode } from 'react';

/**
 * The Баланс bubbles (Figma «Bubbles», 849:216): three joined glass bubbles,
 * the middle one holding the collected-share ring, the outer two the paid and
 * owed sums. The outline is Figma's own vector; the fill, rim and glows are its
 * effects rebuilt as an SVG filter. The card behind already blurs the
 * photograph, so the bubbles take no backdrop-filter of their own
 * (glass-in-code.md).
 *
 * Drawn on a 420 × 154 box and scaled with it: the positions below are that
 * frame's, as percentages.
 */
export function BalanceBubbles({
  left,
  centre,
  right,
}: {
  left: ReactNode;
  centre: ReactNode;
  right: ReactNode;
}) {
  return (
    <div className="relative aspect-[420/154] w-[26.25rem] max-w-full shrink-0">
      <svg
        aria-hidden
        viewBox="2 4 420 154"
        className="absolute inset-0 h-full w-full overflow-visible"
      >
        <defs>
          <filter
            id="bubbles-glass"
            x="-10"
            y="-10"
            width="444"
            height="182"
            filterUnits="userSpaceOnUse"
          >
            {/* A faint outer glow, then a soft white light pooled along the inside of the rim. */}
            <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="outer" />
            <feColorMatrix
              in="outer"
              values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.12 0"
              result="glow"
            />
            <feGaussianBlur in="SourceAlpha" stdDeviation="15" result="inner" />
            <feComposite
              in="SourceAlpha"
              in2="inner"
              operator="arithmetic"
              k2="1"
              k3="-1"
              result="rim"
            />
            <feColorMatrix
              in="rim"
              values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.85 0"
              result="light"
            />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
              <feMergeNode in="light" />
            </feMerge>
          </filter>
          <radialGradient id="bubbles-hole">
            <stop offset="0" stopOpacity="0.3" />
            <stop offset="0.7" stopOpacity="0.18" />
            <stop offset="1" stopOpacity="0" />
          </radialGradient>
          <filter
            id="bubbles-rim"
            x="0"
            y="0"
            width="150"
            height="150"
            filterUnits="userSpaceOnUse"
          >
            <feGaussianBlur in="SourceAlpha" stdDeviation="7" result="blur" />
            <feComposite
              in="SourceAlpha"
              in2="blur"
              operator="arithmetic"
              k2="1"
              k3="-1"
              result="edge"
            />
            <feColorMatrix in="edge" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.35 0" />
          </filter>
        </defs>
        <g filter="url(#bubbles-glass)">
          <path
            d="M212 6C232.778 6 251.582 14.4496 265.164 28.0999C272.424 35.3958 281.694 41 291.986 41H302.493C310.868 41 318.64 37.162 325.532 32.4054C335.042 25.8431 346.572 22 359 22C391.585 22 418 48.4152 418 81C418 113.585 391.585 140 359 140C346.572 140 335.042 136.157 325.532 129.595C318.64 124.838 310.868 121 302.493 121H291.986C281.694 121 272.424 126.604 265.164 133.9C251.582 147.55 232.778 156 212 156C191.222 156 172.418 147.55 158.836 133.9C151.576 126.604 142.306 121 132.014 121H121.507C113.132 121 105.36 124.838 98.4677 129.595C88.9582 136.157 77.4281 140 65 140C32.4152 140 6 113.585 6 81C6 48.4152 32.4152 22 65 22C77.4281 22 88.9582 25.8431 98.4677 32.4054C105.36 37.162 113.132 41 121.507 41H132.014C142.306 41 151.576 35.3958 158.836 28.0999C172.418 14.4496 191.222 6 212 6Z"
            fill="white"
            fillOpacity="0.13"
          />
        </g>
        <path
          d="M212 6.75C232.57 6.75 251.185 15.1143 264.633 28.6289C271.966 35.9992 281.416 41.75 291.986 41.75H302.493C311.094 41.75 319.019 37.8106 325.958 33.0225C335.346 26.5438 346.729 22.75 359 22.75C391.171 22.75 417.25 48.8294 417.25 81C417.25 113.171 391.171 139.25 359 139.25C346.729 139.25 335.346 135.456 325.958 128.978C319.019 124.189 311.094 120.25 302.493 120.25H291.986C281.416 120.25 271.966 126.001 264.633 133.371C251.185 146.886 232.57 155.25 212 155.25C191.43 155.25 172.815 146.886 159.367 133.371C152.034 126.001 142.584 120.25 132.014 120.25H121.507C112.906 120.25 104.981 124.189 98.042 128.978C88.6537 135.456 77.2711 139.25 65 139.25C32.8294 139.25 6.75 113.171 6.75 81C6.75 48.8294 32.8294 22.75 65 22.75C77.2711 22.75 88.6537 26.5438 98.042 33.0225C104.981 37.8106 112.906 41.75 121.507 41.75H132.014C142.584 41.75 152.034 35.9992 159.367 28.6289C172.815 15.1143 191.43 6.75 212 6.75Z"
          stroke="white"
          strokeOpacity="0.38"
          strokeWidth="1.5"
          fill="none"
        />
        {/* The well under the ring, and the rim light around the middle bubble. */}
        <circle cx={212} cy={81} r={56.48} fill="url(#bubbles-hole)" />
        <g transform="translate(137 6)">
          <circle
            cx={75}
            cy={75}
            r={75}
            fill="white"
            fillOpacity="0.01"
            filter="url(#bubbles-rim)"
          />
        </g>
      </svg>

      <div className="absolute top-1/2 left-[15%] -translate-x-1/2 -translate-y-1/2">{left}</div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">{centre}</div>
      <div className="absolute top-1/2 left-[85%] -translate-x-1/2 -translate-y-1/2">{right}</div>
    </div>
  );
}
