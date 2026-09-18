import { Dimensions } from 'react-native';

const windowSize = Dimensions.get('window');

/**
 * `narrow` is tuned for a 375pt phone (iPhone SE class). `wide` is tuned for
 * a 402pt phone (iPhone 17 class). Everything in between is interpolated, and
 * phones outside that range scale with width, clamped so a 320pt phone stays
 * readable and a tablet does not inflate type and padding.
 */
const NARROW_WIDTH = 375;
const WIDE_WIDTH = 402;
const MIN_FACTOR = 0.86;
const MAX_FACTOR = 1.15;

/** Pure width → size mapping. `rs` applies it to the current window. */
export function scaleSize(wide: number, narrow: number, width: number): number {
  if (width <= NARROW_WIDTH) {
    return Math.round(narrow * Math.max(MIN_FACTOR, width / NARROW_WIDTH));
  }
  if (width >= WIDE_WIDTH) {
    return Math.round(wide * Math.min(MAX_FACTOR, width / WIDE_WIDTH));
  }
  const t = (width - NARROW_WIDTH) / (WIDE_WIDTH - NARROW_WIDTH);
  return Math.round(narrow + (wide - narrow) * t);
}

/** Project convention: true on phones wider than the 375pt baseline. */
export const isWide = windowSize.width > NARROW_WIDTH;

/**
 * Responsive size. Pass the 402pt value first and the 375pt value second.
 * Do not hardcode font, padding, margin, or control heights on screens.
 */
export function rs(wide: number, narrow: number): number {
  return scaleSize(wide, narrow, Dimensions.get('window').width);
}

/**
 * Space the floating tab bar covers, plus a gap so content ends above it.
 * Home uses this so the last row of tiles stays fully visible on short phones.
 */
export function floatingTabClearance(bottomInset: number): number {
  const label = rs(14, 12);
  const item = rs(10, 8) * 2 + rs(22, 20) + rs(3, 2) + label;
  const bar = rs(7, 6) * 2 + item;
  const belowBar = Math.max(bottomInset - rs(6, 4), rs(8, 6));
  return belowBar + bar + rs(16, 12);
}

export const screen = {
  width: windowSize.width,
  height: windowSize.height,
  isSmallHeight: windowSize.height < 700,
};

/**
 * Shared layout sizes. Tile heights stay fixed for a given phone so wrapped
 * copy cannot make one card taller than its neighbor; the height itself
 * still scales with `rs` when the phone is smaller or larger.
 */
export const metrics = {
  screenPadding: rs(24, 20),
  titleSize: rs(32, 28),
  subtitleSize: rs(17, 15),
  bodySize: rs(16, 14),
  captionSize: rs(13, 12),
  buttonHeight: rs(56, 50),
  inputHeight: rs(56, 50),
  gridGap: rs(12, 10),
  cardPadding: rs(16, 13),
  /** Home quick-action tile. Room for a 3-line caption beside the arrow. */
  homeTileHeight: rs(196, 176),
  /** Building cash tile. Fits a 2-line title plus value and caption. */
  cashTileHeight: rs(156, 140),
  /** Building issue tile. Fits category, status, and a 2-line title. */
  issueTileHeight: rs(196, 174),
} as const;
