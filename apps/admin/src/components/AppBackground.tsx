import { useEffect, useRef } from 'react';
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

  useEffect(() => {
    const img = ref.current;
    if (!img) return;
    let cancelled = false;

    // Off while this photograph is on its way in, so the gate below can only
    // ever switch the blur on over a picture that has already painted.
    delete document.documentElement.dataset.bgReady;

    const ready = () =>
      // `decode()` resolves when the bitmap is ready, not merely fetched — a
      // cached image otherwise reports `complete` before it has ever painted,
      // and the compositor then samples an empty backdrop and keeps it. The
      // two frames after it are for the photograph to paint and for the
      // filtered layers above it to be re-composited.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (!cancelled) document.documentElement.dataset.bgReady = 'true';
        }),
      );

    img.decode().then(ready, ready);
    return () => {
      cancelled = true;
    };
  }, [theme]);

  return (
    <div className="app-background" aria-hidden>
      <img
        ref={ref}
        key={theme}
        src={theme === 'dark' ? '/bg-dark.webp' : '/bg-light.webp'}
        alt=""
        fetchPriority="high"
        className="h-full w-full object-cover"
      />
      <span className="app-scrim" />
    </div>
  );
}
