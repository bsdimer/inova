/**
 * The «design data» preview: `?fixture=design` fills the screens with the
 * numbers drawn in the Figma frames, so a layout can be compared with its
 * frame one to one before the real data exists.
 *
 * It exists only in a dev server and in a build made with
 * VITE_DESIGN_FIXTURES=1 (the browser tests). docs/features/admin-dashboard.md:
 * a deployed build never shows mock numbers.
 *
 * Every place that pulls in sample data guards it with the literal
 * `import.meta.env.DEV || import.meta.env.VITE_DESIGN_FIXTURES === '1'`,
 * not with this flag: Vite replaces that expression at build time, so in the
 * deployed build the branch is `false`, dead, and the data is left out of the
 * bundle. A flag computed at run time cannot be proven false and keeps the
 * data in. `scripts/check-no-design-data.mjs` checks the bundle in CI.
 */
const AVAILABLE = import.meta.env.DEV || import.meta.env.VITE_DESIGN_FIXTURES === '1';
const KEY = 'inova.designFixture';

function read(): boolean {
  if (!AVAILABLE) return false;
  try {
    const param = new URLSearchParams(window.location.search).get('fixture');
    // Remembered for the tab, so moving between screens keeps the preview.
    if (param === 'design') sessionStorage.setItem(KEY, '1');
    if (param === 'off') sessionStorage.removeItem(KEY);
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export const designFixtureOn: boolean = read();
