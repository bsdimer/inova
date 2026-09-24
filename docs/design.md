# Admin design rules

What the Figma frames do not show by themselves: behaviour, placement and the
translation of the glass material into CSS. Colours are not here, because
they are generated into `apps/admin/src/styles.css` from the Figma variables
V2 Glass and V2 Layout, and nobody edits them by hand.

- **Design source:** Figma `GJgbXLnOXLa6wxZDaKYK7T`, page **Screens**. Only
  frames labelled ОДОБРЕНО are a contract. The pages M1 and M2 are older
  read-only contracts for behaviour.
- **Not in code until drawn:** a frame marked ОТЛОЖЕНО is not built until an
  ОДОБРЕНО frame for it exists.
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
  - `backdrop-filter` goes only on first-level glass (cards, shell, panels),
    never on rows or inside a scrolling list;
  - never use `LAYER_BLUR` on glass;
  - with `prefers-reduced-transparency`, panels become solid.
- The photo sits in a `position: fixed; inset: 0; z-index: -1` layer with a
  gradient scrim. Do not use `background-attachment: fixed`, which is broken
  in iOS Safari.
- The dark theme is the token mode plus the night photo. Nothing is painted
  by hand.

## Windows and navigation

- Pick the window type by what it is for:

  | What opens                                                                                     | Desktop                                                            | 402                                                                 |
  | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------- |
  | A short visit to view something (history, record view)                                         | light right panel, ×                                               | full screen, slides in from the right, «‹ <where from>» (`V2/Back`) |
  | A form (add, edit, assign)                                                                     | light right panel, ×                                               | full screen, × top right                                            |
  | Too wide for a panel (e.g. «Пробно начисляване»)                                               | centred window, about 16:9 and 1280×720, over the dimmed screen, × | as the view row above                                               |
  | A work place (Апартамент, search results) or a multi-step process (import, «Нова организация») | its own page                                                       | its own page                                                        |

- If the user entered data and then presses × or back, ask «Да се откажа ли?».
- Panels and windows keep the header and footer fixed; only the body
  scrolls. On 402, the main action of a view screen is pinned full width at
  the bottom.
- Search on 402 is a mode over the current screen: the field on top and
  «Отказ» on the right. A search result opens a normal page.
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

## Responsive

- The shell follows the ladder in Figma `1074:9754`:
  - from 1728: the full sidebar (232);
  - 1536–1727: a 72 rail that expands in place and pushes the content;
  - 1024–1535: the rail expands over the page, modal, with a scrim, closing
    on Esc or a tap outside;
  - below 1024: a top bar with a drawer.
- The content column is 1136 wide and centred; cards never stretch. From 2400
  the whole layout is drawn ×1.25 (root font-size, sizes in rem).
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
  `glass/inner-soft`.
- Names and prose truncate to one line with an ellipsis, and the full text
  appears in a tooltip. Numbers, dates and IDs never truncate. The
  exception: the reason cell in requests wraps to at most three lines.
- Numbers are right-aligned with `font-variant-numeric: tabular-nums`. In
  money, the stotinki are raised and smaller; the sizes are the Figma text
  styles.
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

## Controls, focus and motion

- An action the user cannot take is dimmed, not hidden, with the reason
  stated next to it. Options the user cannot pick are shown, locked, with the
  reason. The opacities are tokens.
- Field errors show a red edge, an icon and a message line.
- Danger menu items use `panel/status-urgent`; disabled items are dimmed.
- Focus:
  - one ring from the tokens `--focus-edge` and `--focus-glow`, no separate
    `outline`;
  - it shows only on `:focus-visible` and is never removed;
  - fields use their own focus state and get no second ring.
- Nav item hover: `--glass-inner-soft` with no edge, blur or shadow, 150 ms;
  sizes are the Figma component.
- Rail tooltip: to the right of the item, `--panel-fill-strong`, appears
  after 400 ms or at once on keyboard focus.
- Motion:
  - the dashboard ring draws once;
  - no count-up numbers;
  - no replay on refetch;
  - no hover scaling of glass;
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
- Plan codes (B9, D16) never appear in UI text.
