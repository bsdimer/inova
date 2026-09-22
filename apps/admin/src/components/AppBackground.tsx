import { useEffect, useRef } from 'react';
import { useResolvedTheme } from '../lib/theme';

/**
 * The photograph behind the whole app, plus the gradient scrim that keeps text
 * legible over its bright areas.
 *
 * It is a real <img> rather than a CSS background-image: the design calls for a
 * fixed layer, and `background-attachment: fixed` is broken in iOS Safari.
 *
 * `data-bg-ready` gates every `backdrop-filter` in the app. Chromium samples
 * the backdrop of a filtered element once and keeps that sample: if it is
 * taken before the photograph has painted, or before a resize has re-laid the
 * layer out, the glass shows a razor-sharp building through a darkened pane
 * for as long as the page is open. Switching the attribute off and on again
 * forces a fresh sample, so this component does that whenever the backdrop
 * changes underneath. Until it is on the surfaces are plain tints, which is
 * the right fallback.
 */
export function AppBackground() {
  const theme = useResolvedTheme();
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = ref.current;
    if (!img) return;
    const root = document.documentElement;
    let cancelled = false;
    let frame = 0;
    let timer = 0;

    const resample = () => {
      delete root.dataset.bgReady;
      cancelAnimationFrame(frame);
      // Two frames: one for the photograph to paint, one for the filtered
      // layers above it to be composited against it.
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          if (!cancelled) root.dataset.bgReady = 'true';
        });
      });
    };

    // `decode()` rather than `load`: a cached image reports `complete` before
    // it has ever painted, and the sample taken then is an empty one.
    img.decode().then(resample, resample);

    const onResize = () => {
      clearTimeout(timer);
      timer = window.setTimeout(resample, 150);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      window.removeEventListener('resize', onResize);
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
