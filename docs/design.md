# Admin design rules

What the Figma frames do not show by themselves: behaviour, placement and the
translation of the glass material into CSS. Colours are not here, because
they are generated into `apps/admin/src/styles.css` from the Figma variables
V2 Glass and V2 Layout, and nobody edits them by hand.

- **Design source:** Figma `GJgbXLnOXLa6wxZDaKYK7T`, page **Screens**. Only
  frames labelled ОДОБРЕНО are a contract. The pages M1 and M2 are older
  read-only contracts for behaviour.
- **Decisions that change data, permissions or scope** live in
  [plan/decisions.md](plan/decisions.md). This file holds only the
  interface rules.

## Surfaces

- There are three glass fills:
  - `glass/card` for cards and the shell;
  - `glass/data` for tables and lists;
  - `glass/input` for fields, search and sort.
    A control that sits on the photo is a recess, darker than what is behind it.
- Everything layered over the page uses `panel/*`: drawer, window, menu,
  popover, tooltip, the search dropdown and phone sheets.
  - The panel follows the theme: light by day, dark at night.
  - Inside a panel, use only `panel/text*` and `panel/status-*`.
  - Navigation stays glass.
- Drawers and windows use `panel/fill`. Menus and popovers use
  `panel/fill-strong`. The scrim under them is its own full-screen
  `glass/scrim` layer.
- Status colour goes only in dots, icons and borders. Text on glass stays
  white, including error text. A dot's glow has the dot's colour, and muted
  dots have no glow.
- Glass in CSS:
  - a Figma BACKGROUND_BLUR converts at half its radius (28 → `blur(14px)`,
    16 → `8px`), while shadows carry over 1:1;
  - `backdrop-filter` goes on glass that sits on the photo: cards, shell and
    panels (14px); controls on the photo — fields, search, facets, sort,
    secondary buttons, glass tabs, tags (8px); the active nav item (12px).
    Never on table rows or inside a scrolling list;
  - write `-webkit-backdrop-filter` before `backdrop-filter`; the other order
    once shipped a build with no blur in Chrome;
  - `will-change` only on glass that actually animates (the rail expanding),
    never across the board;
  - no blur on text, and at most one glow per card;
  - with `prefers-reduced-transparency`, panels become solid.
- The photo sits in a `position: fixed` layer at `z-index: 0` with the app
  above it at `z-index: 1` — never a negative z-index, which paints the photo
  outside the backdrop root so the glass blurs nothing. It carries a gradient
  scrim. Do not use `background-attachment: fixed`, which is broken in iOS
  Safari. The photo itself is blurred: Figma LAYER_BLUR 6 →
  `filter: blur(3px)`, and the layer is pushed 6 px past each edge
  (`inset: -6px`) so the blurred border does not fade.
- The dark theme is the token mode plus the night photo. Nothing is painted
  by hand.
- Only the card clips its content. Wrappers of glowing buttons never use
  `overflow: hidden`, or the halo is cut in a straight line. A glow around a
  thin stroke (the progress arc) is a blurred copy of the stroke underneath;
  `drop-shadow` on a 1.75 px line gives almost no light.

## Windows and navigation

- Pick the window type by what it is for:

  | What opens                                                                                     | Desktop                                                            | 402                                                                 |
  | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------- |
  | A short visit to view something (history, record view)                                         | light right panel, ×                                               | full screen, slides in from the right, «‹ <where from>» (`V2/Back`) |
  | A form (add, edit, assign)                                                                     | light right panel, ×                                               | full screen, × top right                                            |
  | Too wide for a panel (e.g. «Пробно начисляване»)                                               | centred window, about 16:9 and 1280×720, over the dimmed screen, × | as the view row above                                               |
  | A work place (Апартамент, search results) or a multi-step process (import, «Нова организация») | its own page                                                       | its own page                                                        |

- If the user entered data and then presses × or back, ask «Да се откажа ли?».
- A secondary window keeps the screen under it in place: the list under a
  drawer is dimmed, not replaced, and after closing the user is exactly where
  they were.
- When a page is shorter than the window, its footer with the actions sits at
  the bottom of the window, not in the middle.
- Panels and windows keep the header and footer fixed; only the body
  scrolls. On 402, the main action of a view screen is pinned full width at
  the bottom.
- Search on 402 is a mode over the current screen: the field on top and
  «Отказ» on the right, which returns to the screen the user came from. A
  search result opens a normal page. The search dropdown has no scrim (it
  already sits on a panel with a shadow); its bottom row with keyboard hints
  is always visible.
- Platform scope has no global search: the header search is hidden and the
  filter search finds organisations by name and key. The organisation key
  never appears inside a tenant.
- Breadcrumbs are one component:
  - the current page is the last item;
  - on 402 the middle levels collapse to «…»;
  - panels and windows have no breadcrumbs.
- Approval queues show only what is waiting for a decision; decided and
  withdrawn items sit behind «История», one tab per outcome. The rule itself
  is D27 in [plan/decisions.md](plan/decisions.md).
- A row click, or Enter on the row, opens the record. A row's main action is
  a visible button. The «…» menu holds only secondary actions, and while it
  is open the row keeps its hover state.
- Inside an organisation entered from the platform, a strip on every screen
  says where the user is, that the visit is audited, and how to leave — the
  audited `platform_access` rule is in [plan/security.md](plan/security.md).
  On 402 the strip is one line under the top bar: where the user is, plus
  «Върни се».

## Responsive

- The shell follows the ladder in Figma `1074:9754`:
  - from 1728: the full sidebar (232);
  - 1536–1727: a 72 rail that expands in place and pushes the content; it
    opens on hover after a delay, on a click on its empty space or on the
    brand mark (a second click on the empty space folds it), on touch only
    on tap, and closes when the pointer leaves, on Esc or on a click outside;
    over its empty part the cursor is `col-resize`, over the icons a pointer;
  - 1024–1535: the rail expands over the page, modal, with a scrim, closing
    on Esc, a tap outside or the brand mark again;
  - below 1024: a top bar with a drawer that closes on ×, a tap on the scrim
    or a swipe left; focus then returns to the menu button.
- The content column is 1136 wide and centred; cards never stretch. From 2400
  the whole layout is drawn ×1.25 (root font-size, sizes in rem).
- Nothing is clipped and there is never a horizontal scroll: a card that
  would drop below its minimum width reflows instead (Balance keeps bubbles
  and buttons in a row down to 664 — buttons 184, gap 10, as in `821:1456` —
  and goes full width on tablet).
- Height: cards keep their height, the page scrolls and the photo stays
  fixed. Vertical page padding is 24 when the content does not fit and up to
  64 when it does. From 1037 the dashboard fits as drawn; between 960 and
  1036 it compresses (3 upcoming events instead of 4, tighter gaps in
  Сигнали); below 960 it scrolls. At 1024–1279 «Предстоящи» always shows
  three events — that is the composition (`816:11473`), not the height.
- Tables become cards on 402. On 768 they become a list, and the facets fold
  into «Филтри (n)».
- On 402:
  - two-button footers split 50/50;
  - single buttons are full width;
  - touch targets are at least 44×44.
- The phone filter sheet stages changes and does not apply them live:
  - the main button previews the result («Покажи 7 служители»);
  - «Изчисти» and close are separate actions.

## Tables

- A row is 64 high plus a 1 px divider, with no zebra striping. Hover uses
  `glass/inner-soft`. The row identifier is styled as a link but stays white
  on glass: underline on hover plus the pointer cursor. The whole row is one
  open target, and opening a row is not selecting it.
- Names and prose truncate to one line with an ellipsis, and the full text
  appears in a tooltip. Numbers, dates and IDs never truncate. Exceptions:
  the reason cell in requests wraps to at most two lines with an ellipsis
  and the full text is in the review panel; in the import error table and
  the search dropdown long names wrap.
- Numbers are right-aligned with `font-variant-numeric: tabular-nums`. In
  money, the stotinki are raised and smaller; the sizes are the Figma text
  styles. A hero sum is centred on its integer part: the stotinki are placed
  so they do not shift the centre.
- Every data view has these states: loading (skeleton), empty, no results
  (names the active filters and gives a way out), error with retry, no
  rights, read-only.
- Status sits in a strip between the header and the rows: refresh, success,
  error, read-only, busy.
- A row with a problem gets a non-colour signal, a warning icon.
- The search dropdown:
  - is grouped, with at most 5 per group and a count in each group header;
  - opens from 2 characters;
  - has four states: results, loading, empty, error.
- Import: the column mapping survives a re-upload of the file.

## Controls, focus and motion

- An action the user cannot take is dimmed, not hidden, with the reason
  stated next to it. Options the user cannot pick are shown, locked, with the
  reason. The opacities are tokens.
- Field errors show a red edge, an icon and a message line.
- The status pills on the dashboard's Сигнали card are filters with
  `default` and `selected` states; the list heading and content follow the
  selected pill. «Предложени» in Анкети is not a filter: it opens the queue
  of residents' survey proposals.
- Picking a day in the calendar switches the toggle to «Ден» and shows that
  day's tasks. "Today" and "selected" are independent states and can both
  apply.
- Danger menu items use `panel/status-urgent`; disabled items are dimmed.
- Focus:
  - one ring from the tokens `--focus-edge` and `--focus-glow`, no separate
    `outline`; it has two variants — white on glass, dark on light `panel/*`
    surfaces — and is never thinner than 1.5 px;
  - it shows only on `:focus-visible` and is never removed;
  - fields use their own focus state and get no second ring;
  - keyboard focus on a nav item shows the hover plate plus the ring.
- Nav item hover: `--glass-inner-soft` with no edge, blur or shadow, 150 ms;
  sizes are the Figma component.
- Rail tooltip: to the right of the item, `--panel-fill-strong`, appears
  after 400 ms or at once on keyboard focus. An item with a counter shows
  the number in its tooltip («Известия · 3»), since the rail shows only a
  dot. The expanded sidebar has no tooltips.
- Motion:
  - plays once on load and never replays on refetch;
  - everything is instant with `prefers-reduced-motion`.

## Words

- The UI uses the formal «Вие» form in sentences. Short imperatives on
  buttons are fine.
- One concept, one name (see AGENTS.md):
  - «имот» is any property, and «Ап. 4» is a specific one;
  - «Входни такси», «Фиксирани / Временни разходи»;
  - «Такса» is used only for такса Домоуправление;
  - «Сигнали», never «Нередности»;
  - the roles are Собственик and Наемател, never «Жител»;
  - «Оттегли» is withdrawing one's own request, as opposed to a rejection.
- A count label names what is counted: «4 реда с грешки», not «4 грешки».
- Plan codes (B9, D16) never appear inside UI sentences; a milestone marker
  («M3») may only be a separate badge on a deferred element.
- Lifetimes of links and codes shown on screen come from the endpoint
  response, never hard-coded (B13 in [plan/decisions.md](plan/decisions.md)).
