---
name: figma-reference-match
description: How to change the inova glass mockups in Figma so the first or second pass is right. Use for any edit to file GJgbXLnOXLa6wxZDaKYK7T — glass material, carrying approved blocks over, new screens, icons, contrast. A table or list in the task — load the figma-complex-data-tables skill first; before every showing to the stakeholder — lint the frames (§8a, build-lint.py).
---

# figma-reference-match

Goal: right on the first or second pass, not the tenth.

This file is **how to work in Figma**. What the interface must be is written
elsewhere and not repeated here:

- interface rules — `docs/design.md`;
- words — `docs/glossary.md`;
- decisions on data, permissions and scope — `docs/plan/decisions.md`.

## Every time

1. Before the first `use_figma` — the Figma instructions (§0).
2. A table or list in the task — the `figma-complex-data-tables` skill
   **before the first write**, and its `audit-checklist.md` before showing
   (§0).
3. Read the file, then write; clone approved blocks instead of rebuilding
   them (§1).
4. Look at the result as a screenshot, in both themes when a dark twin
   exists.
5. Bulk replacements only from an explicit list agreed beforehand.
6. An approved frame is not reworked without agreement.
7. Durations and limits on a mockup only with a source in the plan (§8).
8. Before every showing — lint the frames; the list must be empty (§8a).
9. Every showing states what changed and what still differs.
10. A mechanical remark that reached the stakeholder becomes, the same day,
    a lint check or a line in §12.

## 0. Before the first `use_figma` in a session

Load the Figma instructions: `get_figma_skill` →
`skill://figma/figma-use/SKILL.md`, then pass
`skillNames: "resource:figma-use"` in every call. It covers `query`, `set`,
`createAutoLayout`, the `layoutSizing*` rules and the usual failures. For a
new screen or component also load `figma-generate-design` /
`figma-generate-library`.

**A table or list — `figma-complex-data-tables` first.** Invoke it through
Skill before the first write, not afterwards and not from memory. Signs it is
needed: data rows, columns, `Row ·`, `V2/Table`, a list of records with
actions, list states (empty, loading, no results), filters or sorting. When
in doubt, load it. It lives in `~/.codex/skills/` with a symlink in
`~/.claude/skills/`; the Figma MCP index does not list it. Read:

- before the first write — `references/design-method.md` and
  `figma-build-spec.md`;
- before showing — `references/audit-checklist.md`, marking every item
  pass / fail / unknown / not applicable.

Skipping this step has already produced tables without their states and
whole pages that had to be redone.

## 1. Working order

1. **Read, then write.** A read-only call first: what exists, how it is named,
   which tokens and components. Fit your code to the file, not the other way.
2. **If a state is already drawn and approved, carry it over, do not rebuild
   it.** Clone the approved blocks (`node.clone()`) and change only what the
   edit is about. Only what never existed may be built fresh. Rebuilding
   "from similar components" gives a plausible screen that is not the
   approved one.
3. **Put the reference on disk and look at it full size.** From Figma:
   `exportAsync({format:'PNG', constraint:{type:'SCALE', value:2}})`.
4. **Measure, do not guess** (§4). Glass, light and edges cannot be checked by
   numbers alone; without looking at the result it takes dozens of passes.
5. **Crop your result and look at it.** Required for any visual edit:
   arrows that stick out of a card pass the geometry check and fail the eye.
6. **Contrast in both themes** (§5).
7. Iterate two or three times **before showing**. Show when the difference is
   small, and name what still differs.
8. Final values live in Figma components and variables. `docs/design.md`
   gets only behaviour the frames cannot show, through a PR.

## 2. Selecting nodes

- **Use `node.query('TYPE[name^=…]')`.** Walking all descendants and
  comparing `n.name === X` catches too much: Figma names a text layer after
  its content, which can equal its frame's name (a heading once got a card
  fill that way and turned dark).
- The selector parser **does not accept `·`** or other non-ASCII punctuation:
  cut the pattern before the separator (`[name^=Role]`) and filter the rest
  in JS.
- **`findAll` / `findOne` do not enter INSTANCE nodes.** To walk the whole
  tree, recurse over `.children`. A low match count means the edit silently
  did nothing.
- **Hidden layers inside an INSTANCE are not returned by the API.** Once a
  menu item or button is hidden in an instance it cannot be found or shown
  again. If a hidden element is needed, take a fresh instance of the
  component (or a clone of an approved block where it is visible) and hide
  the rest there.

## 3. Glass material: what you see → what to set

Used for the glass hero cards (Balance: `V2/Balance · Bubbles`, `Rim · M`).

| Seen in the reference                 | Figma parameter                                                                                                 |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Thin light line along the edge (кант) | `strokes` white 0.6–0.75, `strokeWeight` 1, `strokeAlign` INSIDE                                                |
| Soft light outward from the edge      | a copy of the shape underneath: fill white 0.3, `LAYER_BLUR` 10–14; or `DROP_SHADOW` white a0.3 r14–20 offset 0 |
| Light haze inside along the rim       | `INNER_SHADOW` white a0.4–0.55, r12–24, offset 0                                                                |
| Milky glass                           | fill white 0.16–0.26 + `BACKGROUND_BLUR` 20–28                                                                  |
| Dark centre (under the ring)          | black ellipse, radial gradient a0.18 → 0 towards the edge                                                       |
| "Thin" ring                           | arc ≈ 3 % of the ring diameter; ring ≈ **0.906** of the `Rim · M` diameter                                      |
| Halo around the arc                   | one `DROP_SHADOW` r6–10 a0.5 on the arc — not two, not a blurred stroke                                         |
| Dot at the end of the bar glow        | at the arc end: angle = percent × 360° clockwise from the top                                                   |
| Metaball from circles                 | circles + rectangular bridges → `figma.union` → `figma.flatten` → `cornerRadius` 30–40 on the vector            |

## 4. Measuring

PIL is available, but **not in the default `python3`**:
`/Library/Developer/CommandLineTools/usr/bin/python3`.

From the reference measure:

- the brightness profile across the edge (glow width outside/inside, edge
  brightness);
- relative sizes: arc thickness / ring diameter, ring / circle, text width /
  diameter;
- fill brightness inside against the background;
- the position of the dot on the arc.

**Comparing your copy with the original:** texts in walk order plus a pixel
difference of the renders (`ImageChops.difference`, `getbbox`, amplified ×6).
If only the letters light up, it is a sub-pixel shift from hug/fill, not a
difference.

**After rebuilding at a new size:** check every `Bubbles` for
`ring.width / rim.width` = 0.906 and matching centres; and separately that no
child sticks out of its parent by more than 2.5 px against the base frame.

## 5. Contrast

AA threshold: **4.5** for small text, **3.0** for non-text.

Method: a narrow band **along the text line**, p95 (p99 for 12 px) of the text
against p15 of the background. A wide box lies: light chips and avatars push
the percentile. Measure **in both themes** — light does not prove dark.

**`glass/data` and `glass/card` invert in the dark theme** — black becomes
white, a recess becomes a highlight. For something that must stay a recess in
both themes there is `glass/chip` (`VariableID:1107:2`, black 0.22 / 0.30).
Which glass goes where — `docs/design.md` → Surfaces.

`text/muted` at 11–13 px on the light photo falls short — raise it to
`text/secondary`.

## 6. Icons

- **The colour lives in the nested VECTOR.** Filling the instance or the
  `glyph` frame paints a solid square.
- The file has two forms: `Icon/warning` — a fill on the VECTOR inside the
  `glyph` frame; `Icon/envelope` — a **stroke** on the VECTOR directly in the
  24×24 component (`strokeWeight` 1.5, round cap/join, constraints SCALE),
  with the instance `fills` hidden. Check what the vector has before
  recolouring.
- The set is Phosphor Light, section «V2 · Icons (Phosphor Light)» on the
  Components page. Anything missing from our slice usually exists in
  Phosphor: import it instead of saying "there is no icon". SVG:
  `cdn.jsdelivr.net/npm/@phosphor-icons/core@2/assets/light/<name>-light.svg`
  (the outline is already a filled path). Build the component like
  `Icon/broom`: 24×24 → `glyph` frame → VECTOR with a white fill, constraints
  SCALE.
- `createNodeFromSvg` without `width`/`height` crops the frame to the glyph —
  always pass `width="256" height="256"`. An invisible `<rect>` imports as a
  VECTOR; delete it (windingRule NONE, short path).

## 7. Technical traps (verified)

- **Never `LAYER_BLUR` on the glass itself**: it blurs the backdrop and kills
  the edge. Softness only in a copy underneath.
- **An INSTANCE does not follow a resize around it.** Fix it with
  `rescale(k)`, which scales strokes, effects and font size; `resize` does
  not. Then recompute `x`/`y` from the parent's centre.
- **`setProperties({Variant})` resets text overrides.** Variants first, then
  text.
- **No `appendChild` into an INSTANCE** — either `detachInstance()` or add a
  property to the component.
- **A `use_figma` error rolls back the whole script.** After an error, read
  the state again instead of assuming.
- **`layoutSizing*` only after `appendChild`** into an auto-layout parent.
- Overlays inside auto-layout — `layoutPositioning = 'ABSOLUTE'`, then x/y;
  child coordinates are relative to the frame, not the canvas.
- **SF Pro is a variable font:** `setRangeFontName` fails with
  «"wdth" is not a valid variation setting». For one style over a whole
  paragraph just assign `.characters` — the first character's style spreads.
  For mixed styles load both and set ranges one by one. Restore a font as
  **`{family, style}` only** — a captured `fontName` carries
  `variationSettings` and crashes the script.
- **A multi-colour label (the status word coloured, the rest grey) breaks
  on `.characters = …`**: the first character's colour spreads over the
  whole text. Change only the range with `deleteCharacters` /
  `insertCharacters`, then check `getStyledTextSegments(['fills'])` and a
  screenshot. Section labels sit outside frames, so the lint does not see
  them.
- **`\b` in JS regular expressions does not work with Cyrillic** — use
  `(?![а-я])` or `[^а-яА-Я]` as the word boundary.
- `rotation` on a frame inside auto-layout may render mirrored.
- Text after `rescale` gets a fractional `fontSize` — round it.
- An instance made with `createInstance` loses `rotation`.
- **`setTextStyleIdAsync` with a wrong id does nothing and says nothing.** A
  local style id ends with a comma (`S:…,`); an id copied without it is
  silently ignored. Take the style by name from `getLocalTextStylesAsync()`
  and read `textStyleId` back after setting it.

## 8. Numbers and text on a mockup

Durations, limits, counters and lifetimes **must have a source** in the plan
(`docs/plan/decisions.md`, `docs/plan/security.md`, the milestones). A
plausible invented number reads as decided and goes into the code. With no
source, leave the number out (e.g. «PDF, JPG или PNG» without a size limit).

## 8a. Before showing — lint the frames

Any comment to the stakeholder («Направено» / «Добавени са…» /
«погледнете») goes out only after the lint. Mechanical remarks (a colour not
from a variable, a glow of the wrong colour, a «+» that is not white, a word
from Avoid) must not reach the stakeholder, whose job is product decisions,
not proofreading.

1. Build the code: `build-lint.py <frame id> …` (in this folder) — list every
   frame that will be shown and every frame the edit touched. The script
   takes the Avoid words from `docs/glossary.md` on `origin/develop` and the
   exceptions from `allow.json`. An Avoid list the glossary marks «for this
   one field only» (e.g. «категория» in «За какво е») is not linted: the word
   is right everywhere else. A word that is itself part of a glossary term
   («Изтрий достъпа», «входна такса») gets an `allow.json` entry naming the
   term.
2. Pass the printed code to `use_figma` as is. It only reads.
3. **The list must be empty.** Fix each finding, or — if it is a deliberate
   decision — add it to `allow.json` with a `why` (which decision and when,
   no names) and a narrow `detail`. No exception without a source.
4. Anything not drawn yet (e.g. a missing 402) is named in the comment under
   "what still differs", not left silent.

What `lint-frame.js` checks:

| Rule             | Catches                                                                                                                                                               |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `unbound-colour` | a fill or stroke without a V2 Glass / V2 Layout variable on a layer drawn in the frame itself (instance internals are component debt, checked on the Components page) |
| `dot-glow`       | a status dot without glow or with a glow of another colour; a glow on a muted dot                                                                                     |
| `type-scale`     | a font size / line height outside the text-style scale; a fractional font size                                                                                        |
| `avoid-word`     | a word from the glossary's Avoid lists (case-sensitive)                                                                                                               |
| `number-source`  | «N минути / часа / дни / опит» — a duration or limit that needs a source (§8)                                                                                         |
| `circle-button`  | an overridden fill on `V2/Button · Circle`; a «+» outside a button                                                                                                    |
| `series`         | siblings of the same width have a dark twin or a 402 and this frame has none (twins are matched by frame name without width and theme — name frames as a pair)        |
| `series-glass`   | a card with the same name in a sibling frame sits on a different glass                                                                                                |
| `panel-text`     | text bound to a glass `text/*` variable (white) on a light panel surface (`panel/fill`, `panel/row`, `panel/control`…) — it takes `panel/text` or `panel/text-muted`  |
| `overflow`       | a clipped vertical container whose content is more than 4 px taller than itself, with no `Fade` / `Scrollbar` next to it (docs/design.md → panels: cue or tighten)    |
| `past-edge`      | a direct child of the frame (panel, sheet, card) that runs more than 2 px below the frame's bottom edge                                                               |

To look at the result, put the screenshots side by side with `shots.py`
(in this folder) instead of downloading and cropping them one by one:

```
shots.py OUT.png "<get_screenshot URL>@x0,y0,x1,y1=Label" "<URL or file>=Label" …
```

`@…` crops, `=…` captions, all images are scaled to one height (`--vertical`
stacks them). A fresh screenshot URL renders for a second; the script waits.

What the lint does **not** catch — check by eye:

- text next to a button means the same as the button (when a button is
  renamed, search the neighbouring texts of the frame and component for its
  old word);
- section labels «ОДОБРЕНО / ЗА ПРЕГЛЕД» (outside frames, §7);
- repeats (the same word as a section heading and a field label right
  below), and the formal address «ви» in lower case, as in the rest of the
  file;
- effect colours: there are no effect tokens yet.

## 8b. After the merge — accept the screen once

E2E tests check behaviour and words, not that the panel is 520 wide, that a
caption sits on `panel/text-muted` and not `panel/text-faint`, or that the type
scale and spacing are the frame's. That check is this session's, once per
screen, after the PR that first builds it is merged (rule of 30.09).

1. The code session sends: the PR number, the screen and its route, the
   frame ids, and the PR's «Kept from the code, not the frame, on purpose»
   list in full. If that session is no longer running, the reply goes to the
   session that owns the admin code now.
2. Open the admin **locally** (`preview_start admin` with `api` and
   `auth-service` running on the seeded database; the test account is in
   `apps/admin/e2e/session.ts` — never type a password on an external host)
   at 1728 and 402, light and dark, and at about 700 high as well — at 1117 a
   panel often fits, and the scroll cue and the buttons at the end only show
   on a short window. The dark theme: set `inova.theme` to `dark` in
   localStorage and reload — «Динамична» follows the time of day; remove the
   key afterwards. Put the **latest approved** frame beside it (`shots.py`).
   Compare only what is measurable: block sizes and spacing, the type scale,
   surface and text tokens, the words, the states (empty, error, loading).
3. Reply to the code session in one message: «Расходится: …» with frame ids
   and numbers, or one line «расхождений нет». Mechanical differences go
   back as a small PR; a deliberate difference from the frame («radio, not
   check boxes») is a product decision — list it for Helga, do not argue it
   in chat.
4. Once per screen. Later state, wording, contrast or refactoring PRs get
   no second pass — their screenshots in the PR are enough. No repeat full
   audits (§12).

## 9. Before calling something a gap — read the contract

**Screens shows how it looks. M1 and M2 say how it works.** Completeness
cannot be judged from the glass frames alone.

Tables were once run through the complex-data-tables checklist looking only at
Screens, and five gaps were reported: no keyboard focus, sorting by icon only,
non-tabular numbers, no selection or bulk, mobile filters applied live. **All
five were already settled** — on M1 the filter sheet `153:2939` and the table
states sheet `47:1079`, on M2 the frame `113:5992` «M2 tables — behaviour
spec»: tab order, a 2 px focus ring, sorting in words, `tabular-nums`, a sticky
header, truncation, and an explicit decision that M2 has no selection or bulk.

Before any "this is missing":

1. Find the contract frame on M1/M2 for the screen and read it in full,
   including the note frames next to it (`… — note`) and the summary spec
   frames.
2. Only then compare with Screens.
3. Tell apart **no decision** (a finding) and **a decision not yet drawn in
   glass** (a missing frame, not a defect).

## 10. Where things are

- **Pages:** Foundations, Components, Screens, M1 · Context & States,
  M2 · Property, V2 · Glass direction.
- **Screens** — all live screens, in sections in flow order: Вход → Табло →
  Служители → Сгради → Сграда → Импорт на имоти → Апартамент →
  Добави жител → Жители → Роли → Организации → Адаптив (Табло) → Търсене →
  Основи и решения → Старо (pre-V2 warm style, do not edit).
- A section label above each row of frames: «ОДОБРЕНО <date>» (approved,
  a contract) or «ЗА ПРЕГЛЕД» (awaiting review), then the frames it covers and
  the issue.
- **M1 · Context & States** and **M2 · Property** — the behaviour contract in
  the old warm style. Read, do not redraw, add nothing there.
- **V2 · Glass direction** — history only since 21.09.2026: trials and early
  variants. Nothing to edit.
- Components — page Components, section «V2 · Glass». Variables — the
  «V2 Glass» collection (`VariableCollectionId:839:2`, modes Светла /
  Тъмна) and «V2 Layout» (`VariableCollectionId:839:40`).
- Each table has its own components: `V2/Table · Header · <section>` and
  `V2/Table · Row · <record>` (variants default / hover). A new table gets a
  new pair, built from the closest existing one.
- Desktop frames are 1728×1117: the shell is 1392 wide and centred (168 on
  each side) — sidebar 232, gap 24, content 1136.

## 11. Reading remarks on mockups

These are not interface words (those are in `docs/glossary.md`) but the
Bulgarian terms used in comments on frames for drawing techniques.

- «бели стрелки» — **white circle buttons** with a dark arrow, not a white
  arrow on glass.
- «пилове с жълто, синьо, червено и зелено» — **coloured icons** inside white
  glass pills; text and fill stay white.
- «като преди» — as in the previously shown frame; before reverting, find an
  untouched frame and read the values from it.
- «кант» — the thin light line along an edge; «glow» — glow; «горчица» —
  gold `#E6C58A`, rejected; the warm theme is 2700 K light (`#F5A65B` core,
  `#FFCF9C` halo), for the night frame only.
- «светла тема — бяло» — the day theme (glass on the sunset photo) with a
  white glow; «тъмна» — the night photo with warm light.
- «опушено стъкло» — the darkened card glass (`glass/card`), as in the
  sibling frames of the series.

## 12. Non-negotiable

- The desktop grid stays as drawn (§10); do not move it for the material.
- Bulk replacements only from an explicit list, never "everything similar".
- An approved frame is not reworked without agreement: if the plan asks for
  something else, that is a finding for the report, not a reason to edit.
- Every showing lists what changed and what still differs.
- Frames of one series are named as a pair: `V2 · <Screen> <width> · <state>`
  — otherwise the lint cannot find the dark twin and the 402.
- Comments in Linear are impersonal: «Направено — …», «Добавени са екраните
  за …»; no «нарисувах», no thanks.
