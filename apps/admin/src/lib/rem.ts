/**
 * A length from the design, given in the frames' pixels, as rem. Every size
 * in the admin is in rem so that the whole layout grows with the root font
 * size — from 2400 wide the root is 20px and the 1728 composition is drawn
 * ×1.25 (Figma 824:1609, `design/inova-admin/README.md` → Адаптив).
 */
export const rem = (px: number): string => `${px / 16}rem`;
