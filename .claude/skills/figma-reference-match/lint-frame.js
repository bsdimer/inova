// Frame lint before showing. Do not run as is: build-lint.py fills in the
// frame ids, the Avoid words and the exceptions and prints code for use_figma.
// Read-only: changes nothing in the file.

const FRAME_IDS = __FRAME_IDS__;
const AVOID = __AVOID__; // [{word, entry}] from docs/glossary.md → Avoid
const ALLOW = __ALLOW__; // [{text, rule, why, detail?}] — accepted exceptions

const COLLECTIONS = ['VariableCollectionId:839:2', 'VariableCollectionId:839:40']; // V2 Glass, V2 Layout
const STATUS = { e8c15a: 'pending', '6fa8ff': 'planned', ff6b61: 'urgent', '4cbf8b': 'resolved' };
const WARM_GLOW = ['f5a65b', 'ffcf9c', 'fff3ea']; // warm night glow — intended
const CIRCLE_SET = '846:160'; // V2/Button · Circle
const PLUS_ICON = '496:38'; // Icon/plus · Phosphor Light
// §8: durations and limits («валиден 10 минути», «3 опита»). The age of a
// record («преди 3 ч.», «3 ч.» in an issue row) is sample data, not a limit.
// §8: a sentence that promises behaviour (sends, blocks, after activation…)
// needs a plan section or merged code. Listed for a check by hand, not counted
// as a finding: the source is in the plan, which the lint cannot read.
const BEHAVIOUR = /(изпраща|изпратен|тръгва|блокира|автоматично|след активиран|след като|не може да|изисква|изтрива|архивира|получава|вижда)/i;
const NUMBER_UNITS = /\d+\s*(минути|минута|часа|час(?![а-я])|дни|ден(?![а-я])|опита|опит(?![а-я]))/i;
const SKIP_NAMES = /^(BG photo|Scrim|Drawer scrim|Fold|Fold label|Note|Label)/;

const hex = (c) => [c.r, c.g, c.b].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
const findings = [];
const toCheck = []; // behaviour sentences: find the plan or code source by hand (§8)
const add = (rule, node, detail) => {
  // an exception matches the layer text, or the name for frames and cards
  const subject = node.type === 'TEXT' ? node.characters : node.name;
  // `detail` narrows an exception to one finding (e.g. only the dark twin)
  if (ALLOW.some((a) => a.rule === rule && subject.includes(a.text) && (!a.detail || detail.includes(a.detail)))) return;
  findings.push({ rule, id: node.id, name: node.name.slice(0, 60), detail });
};

const varCache = {};
async function variable(id) {
  if (!(id in varCache)) varCache[id] = await figma.variables.getVariableByIdAsync(id);
  return varCache[id];
}
async function paintVar(p) {
  const b = p.boundVariables && p.boundVariables.color;
  return b ? variable(b.id) : null;
}

const styleScale = new Set(
  (await figma.getLocalTextStylesAsync()).map((s) => `${s.fontSize}/${s.lineHeight.unit === 'AUTO' ? 'AUTO' : Math.round(s.lineHeight.value * 100) / 100 + (s.lineHeight.unit === 'PERCENT' ? '%' : '')}`),
);

async function checkPaints(node, key, label) {
  const paints = node[key];
  if (!Array.isArray(paints)) return;
  for (const p of paints) {
    if (p.visible === false || p.type !== 'SOLID' || p.opacity === 0) continue;
    const v = await paintVar(p);
    if (!v) add('unbound-colour', node, `${label} #${hex(p.color)} without a variable`);
    else if (!COLLECTIONS.includes(v.variableCollectionId)) add('unbound-colour', node, `${label}: variable not from V2 (${v.name})`);
  }
}

// Effect colours are not checked: there are no effect tokens yet.

// Glass text (text/*, white on the photo) is unreadable on a light panel
// surface; text there takes panel/text or panel/text-muted. The surface is the
// nearest ancestor with a fill bound to a variable.
const LIGHT_PANEL = /^panel\/(fill|fill-strong|row|row-strong|control|footer)$/;
async function surfaceVar(node) {
  for (let p = node.parent; p && p.type !== 'SECTION' && p.type !== 'PAGE'; p = p.parent) {
    const f = Array.isArray(p.fills) && p.fills.find((x) => x.visible !== false && x.type === 'SOLID' && x.opacity !== 0);
    if (!f) continue;
    return paintVar(f);
  }
  return null;
}
async function checkPanelText(node) {
  const fills = Array.isArray(node.fills) ? node.fills : [];
  for (const p of fills) {
    if (p.visible === false || p.type !== 'SOLID') continue;
    const v = await paintVar(p);
    if (!v || !/^text\//.test(v.name) || v.name === 'text/on-solid') continue;
    const s = await surfaceVar(node);
    if (s && LIGHT_PANEL.test(s.name)) add('panel-text', node, `${v.name} on ${s.name} — use panel/text or panel/text-muted`);
    return;
  }
}

// A clipped vertical container whose content is taller than itself hides the
// rest. It needs a scroll cue next to it (V2/Drawer · Fade, and on desktop
// V2/Drawer · Scrollbar) — or the content has to be tightened (docs/design.md).
// Content is cut only where a child runs past the container's edge. Summing
// heights plus padding reported a short bottom padding as «hidden» (Табло's
// «Card · Сгради»: 17 px padding instead of 24 read as 6 px cut, ~25 frames).
function contentHeight(n) {
  const kids = n.children.filter((k) => k.visible && k.layoutPositioning !== 'ABSOLUTE');
  return kids.reduce((m, k) => Math.max(m, k.y + k.height), 0);
}
function checkOverflow(node) {
  if (!('layoutMode' in node) || node.layoutMode !== 'VERTICAL' || !node.clipsContent || !node.children || !node.children.length) return;
  const hidden = Math.round(contentHeight(node) - node.height);
  if (hidden <= 4) return;
  const around = node.parent && node.parent.children ? node.parent.children : [];
  const cue = around.some((k) => k.visible && /^(Fade|Scrollbar)$/.test(k.name));
  if (!cue) add('overflow', node, `${hidden} px hidden below, no Fade / Scrollbar next to it`);
}

// A panel, sheet or card that runs past the bottom of the frame is cut by it.
function checkPastEdge(frame) {
  if (!frame.clipsContent) return;
  for (const c of frame.children) {
    if (!c.visible || SKIP_NAMES.test(c.name)) continue;
    const past = Math.round(c.y + c.height - frame.height);
    if (past > 2) add('past-edge', c, `${past} px below the frame edge`);
  }
}

async function checkDot(node) {
  if (node.type !== 'ELLIPSE' || node.width > 12) return;
  const f = Array.isArray(node.fills) && node.fills.find((p) => p.visible !== false && p.type === 'SOLID');
  if (!f) return;
  const fv = await paintVar(f);
  const fillHex = hex(f.color);
  const isStatus = (fv && /^status\//.test(fv.name)) || STATUS[fillHex];
  const glows = (node.effects || []).filter((e) => e.type === 'DROP_SHADOW' && e.visible !== false);
  if (!isStatus) {
    if (fv && /muted|faint|text\//.test(fv.name) && glows.length) add('dot-glow', node, `muted dot (${fv.name}) has a glow`);
    return;
  }
  if (!glows.length) add('dot-glow', node, 'status dot without glow');
  for (const g of glows) {
    const gb = g.boundVariables && g.boundVariables.color;
    const gv = gb ? await variable(gb.id) : null;
    const same = gv && fv ? gv.id === fv.id : hex(g.color) === fillHex;
    if (!same && !WARM_GLOW.includes(hex(g.color)) && !(gv && /glow\/dot/.test(gv.name))) {
      add('dot-glow', node, `glow ${gv ? gv.name : '#' + hex(g.color)} ≠ dot ${fv ? fv.name : '#' + fillHex}`);
    }
  }
}

function checkText(node, inInstance) {
  const text = node.characters;
  if (!text.trim()) return;
  const lh = node.lineHeight;
  if (!inInstance && typeof node.fontSize === 'number' && lh !== figma.mixed) {
    if (node.fontSize % 1) add('type-scale', node, `fractional font size ${node.fontSize}`);
    const key = `${node.fontSize}/${lh.unit === 'AUTO' ? 'AUTO' : Math.round(lh.value * 100) / 100 + (lh.unit === 'PERCENT' ? '%' : '')}`;
    if (!node.textStyleId && !styleScale.has(key)) add('type-scale', node, `${key} not in the text-style scale`);
  }
  for (const a of AVOID) {
    if (new RegExp(`(^|[^а-яА-Я])${a.word}([^а-яА-Я]|$)`).test(text)) add('avoid-word', node, `«${a.word}» — ${a.entry}`);
  }
  if (NUMBER_UNITS.test(text)) add('number-source', node, 'duration or limit — needs a source in the plan (§8)');
  if (!inInstance && BEHAVIOUR.test(text)) toCheck.push({ id: node.id, text: text.slice(0, 120) });
}

async function checkCircle(node) {
  if (node.type !== 'INSTANCE') return;
  const main = await node.getMainComponentAsync();
  if (!main) return;
  const setId = main.parent && main.parent.type === 'COMPONENT_SET' ? main.parent.id : main.id;
  if (setId === CIRCLE_SET) {
    if (JSON.stringify(node.fills) !== JSON.stringify(main.fills)) add('circle-button', node, 'circle button fill overridden');
    return;
  }
  if (main.id === PLUS_ICON) {
    let inButton = false;
    for (let p = node.parent; p && p.type !== 'SECTION' && p.type !== 'PAGE'; p = p.parent) {
      if (p.type !== 'INSTANCE') continue;
      const m = await p.getMainComponentAsync();
      const owner = m && m.parent && m.parent.type === 'COMPONENT_SET' ? m.parent : m;
      // a «+» inside a chip (V2/Chip · panel, Kind=add — the insert fields of «Ново известие») is the chip's own
      if (owner && (owner.id === CIRCLE_SET || /Button|Chip/.test(owner.name))) { inButton = true; break; }
    }
    if (!inButton) add('circle-button', node, '«+» outside V2/Button or a chip — hand-drawn');
  }
}

// Colour and type scale are checked only on layers drawn in the frame itself:
// instance internals are component debt, checked on the Components page.
// Dots, words, durations and circle buttons are checked everywhere: overrides.
async function walk(node, visible, inInstance, isRoot) {
  const vis = visible && ('visible' in node ? node.visible : true);
  if (!vis || SKIP_NAMES.test(node.name)) return;
  if (!inInstance && !isRoot) {
    await checkPaints(node, 'fills', 'fill');
    await checkPaints(node, 'strokes', 'stroke');
  }
  await checkDot(node);
  if (node.type === 'TEXT') checkText(node, inInstance);
  if (node.type === 'TEXT' && !inInstance) await checkPanelText(node);
  if (!isRoot) checkOverflow(node);
  await checkCircle(node);
  if ('children' in node) for (const c of node.children) await walk(c, vis, inInstance || node.type === 'INSTANCE', false);
}

// Series: a dark twin / 402 among siblings, and the same glass on same-named cards.
// \b in JS ignores Cyrillic — word boundaries via (?![а-я]).
const DARK = /тъмна(?![а-я])/;
const seriesKey = (n) => n.replace(/^V2 · /, '').replace(/(^|\D)(1728|1536|1280|1024|768|402|375)(?!\d)/g, '$1').replace(/(светла|тъмна)(?![а-я])/g, '').replace(/[—·\s]+/g, ' ').trim();
async function checkSeries(frame) {
  const sec = frame.parent;
  if (!sec || sec.type !== 'SECTION') return;
  const sibs = sec.children.filter((c) => c.type === 'FRAME' && c !== frame);
  const key = seriesKey(frame.name);
  const same = sibs.filter((s) => seriesKey(s.name) === key);
  // a dark twin is expected only if siblings of the same width have one
  const secHasDark = sibs.some((s) => s.width === frame.width && DARK.test(s.name));
  const secHas402 = sibs.some((s) => /\b402\b/.test(s.name));
  if (secHasDark && !DARK.test(frame.name) && !same.some((s) => DARK.test(s.name))) add('series', frame, 'no dark twin: same-width siblings have one');
  if (secHas402 && !/\b402\b/.test(frame.name) && frame.width > 402 && !same.some((s) => /\b402\b/.test(s.name))) add('series', frame, 'no 402: the section has 402 frames');
  const cards = frame.findAll((n) => n.type === 'FRAME' && /^Card · /.test(n.name));
  for (const c of cards) {
    const cv = Array.isArray(c.fills) && c.fills[0] ? await paintVar(c.fills[0]) : null;
    for (const s of sibs) {
      const twin = s.findOne((n) => n.type === 'FRAME' && n.name === c.name);
      if (!twin || !Array.isArray(twin.fills) || !twin.fills[0]) continue;
      const tv = await paintVar(twin.fills[0]);
      if ((cv && cv.id) !== (tv && tv.id)) {
        add('series-glass', c, `glass ${cv ? cv.name : 'no variable'} ≠ «${s.name.slice(0, 40)}»: ${tv ? tv.name : 'no variable'}`);
        break;
      }
    }
  }
}

let pageSet = false;
for (const id of FRAME_IDS) {
  const f = await figma.getNodeByIdAsync(id);
  if (!f) { findings.push({ rule: 'missing', id }); continue; }
  if (!pageSet) {
    let p = f; while (p.type !== 'PAGE') p = p.parent;
    await figma.setCurrentPageAsync(p); pageSet = true;
  }
  await walk(f, true, false, true);
  checkPastEdge(f);
  await checkSeries(f);
}

const byRule = {};
for (const x of findings) byRule[x.rule] = (byRule[x.rule] || 0) + 1;
return { frames: FRAME_IDS.length, total: findings.length, byRule, findings: findings.slice(0, 120), behaviourToCheck: toCheck.slice(0, 60) };
