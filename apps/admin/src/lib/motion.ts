import { MotionGlobalConfig } from 'framer-motion';

const REDUCE = '(prefers-reduced-motion: reduce)';

/**
 * With «reduce motion» on, everything is instant (design.md → Controls,
 * focus and motion). The CSS reset in styles.css covers transitions; this
 * covers framer-motion, which animates from JavaScript. `skipAnimations`
 * rather than `MotionConfig reducedMotion="user"`: the latter keeps opacity
 * fades, and the rule is «instant», not «no movement».
 */
export function initReducedMotion(): void {
  const query = window.matchMedia(REDUCE);
  const apply = () => {
    MotionGlobalConfig.skipAnimations = query.matches;
  };
  apply();
  // The setting can change while the page is open; the app lives as long as
  // the page, so the listener is never released.
  query.addEventListener('change', apply);
}
