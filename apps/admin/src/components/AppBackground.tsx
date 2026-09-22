import { useCallback, useEffect, useRef } from 'react';
import { useResolvedTheme } from '../lib/theme';

/**
 * The photograph behind the whole app, plus the gradient scrim that keeps text
 * legible over its bright areas.
 *
 * It is a real <img> rather than a CSS background-image: the design calls for a
 * fixed layer, and `background-attachment: fixed` is broken in iOS Safari.
 *
 * `data-bg-ready` gates every `backdrop-filter` in the app. Chromium samples the
 * backdrop for a filtered element once and does not re-sample it when an image
 * decodes later, so switching the blur on a frame after the photograph has
 * painted is what makes the glass show a blurred building instead of a sharp
 * one. Until then the surfaces are plain tints, which is the right fallback.
 */
export function AppBackground() {
  const theme = useResolvedTheme();
  const ref = useRef<HTMLImageElement>(null);

  const markReady = useCallback(() => {
    // Two frames: one for the photograph to paint, one for the compositor to
    // pick up the filtered layers above it.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        document.documentElement.dataset.bgReady = 'true';
      }),
    );
  }, []);

  // A cached image can finish before React attaches the load handler.
  useEffect(() => {
    if (ref.current?.complete) markReady();
  }, [markReady, theme]);

  return (
    <div className="app-background" aria-hidden>
      <img
        ref={ref}
        key={theme}
        src={theme === 'dark' ? '/bg-dark.webp' : '/bg-light.webp'}
        alt=""
        fetchPriority="high"
        onLoad={markReady}
        onError={markReady}
        className="h-full w-full object-cover"
      />
      <span className="app-scrim" />
    </div>
  );
}
