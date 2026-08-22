import { Dimensions } from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

/** Project convention: conditional styling for devices wider than 375pt. */
export const isWide = screenWidth > 375;

/** Responsive size: pick the larger value on wide screens (>375pt). */
export function rs(wide: number, narrow: number): number {
  return isWide ? wide : narrow;
}

export const screen = {
  width: screenWidth,
  height: screenHeight,
  isSmallHeight: screenHeight < 700,
};

/** Standard paddings/font sizes used across screens. */
export const metrics = {
  screenPadding: rs(24, 20),
  titleSize: rs(32, 28),
  subtitleSize: rs(17, 15),
  bodySize: rs(16, 14),
  captionSize: rs(13, 12),
  buttonHeight: rs(56, 50),
  inputHeight: rs(56, 50),
} as const;
