# Pitfalls

What breaks when a top nav becomes a sidebar. Read before phase 3, and pass this file to any subagent that edits components.

Each entry gives the symptom, how to detect it, and the fix. "Audit" means the output of `scripts/audit.mjs`.

## Layout

### 1. Sticky bar leaves a gap or hides under the top bar
- **Symptom:** a filter or toolbar sticks 60 to 80px below the top of the page with empty space above it.
- **Detect:** audit `offsets tied to nav`. After the old nav rules are deleted, the audit only finds these when run with `--nav-px=<old height>`.
- **Fix:** set the offset to `top: var(--topbar-height)`. Do not use `0` unless there is no utility bar.

### 2. Bar spans underneath the sidebar
- **Symptom:** a full-width bar starts at the left edge of the window, behind the sidebar.
- **Detect:** audit `rendered before <main>`.
- **Fix:** move the component inside the main column. It must not be a direct child of the grid.

### 3. Page is wider than the window
- **Symptom:** horizontal scrollbar on the page. One wide table pushes everything sideways.
- **Detect:** in the browser, `document.documentElement.scrollWidth > window.innerWidth`.
- **Fix:** `min-width: 0` on the main column, and `overflow-x: auto` on the table's wrapper, not on the page.

### 4. Top bar, filter bar and content do not line up
- **Symptom:** left edges differ by a few pixels between the bars and the page content.
- **Detect:** audit `page-width containers` shows the same value in more than one file.
- **Fix:** delete each copy and use the shared `.app-container` class.

### 5. Sticky stops working
- **Symptom:** a bar scrolls away instead of sticking.
- **Detect:** an ancestor has `overflow: hidden`, `auto` or `scroll`.
- **Fix:** keep page scroll on `body`. Do not give the main column `overflow` or a fixed height.

### 6. Sidebar scrolls away or is cut off
- **Symptom:** on a long page the sidebar leaves the screen, or its last links are unreachable on a short window.
- **Fix:** `position: sticky; top: 0; height: 100dvh; align-self: start` on the sidebar, and `overflow-y: auto` on the link list only.

### 6a. Main column drops below the sidebar
- **Symptom:** the content starts underneath the sidebar, or a blank band appears beside it.
- **Detect:** the grid has a third child in flow: a modal component, a backdrop, or the old root wrapper.
- **Fix:** move modals after the grid. Keep the backdrop `display: none` outside drawer mode. Replace the old root element, do not nest the grid inside it.

### 6b. Padding is doubled around the content
- **Symptom:** page content is inset twice as far as the top bar.
- **Detect:** the old content wrapper's rule (for example `.main-content`) still applies to `<main>`.
- **Fix:** delete the old rule when adding the new container.

## Layering

### 7. Dropdown opens off screen
- **Symptom:** profile or language menu opens below the window, or extends past the left edge.
- **Detect:** audit `dropdowns opening down` marked `in header`.
- **Fix:** keep those components in the utility bar, where down and right-aligned still works. Only the sidebar-footer variant needs menus that open upward.

### 8. Dropdown is clipped
- **Symptom:** an open menu is cut off at the edge of its bar or of the sidebar.
- **Detect:** an ancestor of the menu has `overflow: hidden` or `overflow: auto`.
- **Fix:** remove the overflow from that ancestor. Never put `overflow` on the top bar or the sidebar root.

### 9. Open menu sits behind a sticky bar
- **Symptom:** a menu opened from the top bar is covered by the filter bar below it.
- **Detect:** the sticky bar's `z-index` is equal to or higher than the top bar's.
- **Fix:** use the ladder: `--z-sticky` (100) is lower than `--z-topbar` (200).

### 10. Modal and dropdown share a z-index
- **Symptom:** an open dropdown shows on top of a modal.
- **Detect:** audit `z-index ladder` shows modals and dropdowns at the same value.
- **Fix:** modals use `--z-modal`, dropdowns use `--z-dropdown`.

### 11. Modals lose their styling
- **Symptom:** after tokenising, modals have no colours or spacing.
- **Detect:** audit `teleported components` is above 0 and tokens are defined on the app root element.
- **Fix:** define tokens on `:root`.

## Styles

### 12. Global styles vanish from every view
- **Symptom:** cards, tables and badges lose their styling across the app.
- **Detect:** audit `unscoped style in`. That block was styling every view.
- **Fix:** when moving global rules to a `.css` file, import it from the entry file. When leaving them in the shell file, keep the block unscoped.

### 13. One view looks different from the rest
- **Symptom:** after changing the shared card style, one page still has its old radius, shadow or padding.
- **Detect:** audit `scoped redefinitions`.
- **Fix:** in `full` mode, delete the whole scoped copy so the shared rule applies. The view then takes the shared look, which is the point.
- **Layout-only leftovers:** if the scoped copy also set something the view needs for its layout, such as a top margin on one grid, keep just that declaration under a new class name specific to the view.

### 14. New sidebar picks up unrelated styles
- **Symptom:** the brand or a label has an unexpected border, size or colour.
- **Detect:** the app has global rules for generic names such as `.logo`, `.subtitle`, `.card`, `.error`, or bare element selectors (audit `bare element selectors`).
- **Fix:** prefix every class in the sidebar with `sidebar-`.

### 15. Rule silently stops matching
- **Symptom:** spacing around a moved component changes.
- **Detect:** a parent selector reaches into a child component's root class, for example `.nav-container > .language-switcher`.
- **Fix:** delete the rule and space the new parent with `gap`.

### 16. Colour does not change with the tokens
- **Symptom:** one chart segment or status dot keeps its old colour.
- **Detect:** audit `hex outside <style>`.
- **Fix:** see "Colours outside style blocks" in [design-tokens.md](design-tokens.md).

## Content

### 17. A row of cards wraps unevenly
- **Symptom:** a row of five cards becomes four and one, or a two-column section becomes one column, at 1280 to 1440px.
- **Detect:** compare [grid rows](verification.md#baseline) with the baseline, on **every** route. Shared grids such as a global stats grid break on several pages at once. The audit's `width-sensitive rules` lists likely causes, but it only flags minimums of 300px or more. A `minmax(220px, 1fr)` grid with five cards also breaks.
- **Cause:** the sidebar takes about 250px that those rules assumed they had.
- **Fix:** lower the grid's `minmax()` minimum until the row fits at 1440.
- **Arithmetic:** the largest minimum that fits `n` items is `(content width - (n - 1) x gap) / n`. Content width is the viewport minus the sidebar and both gutters. Example: 1440 - 248 - 64 = 1128; five cards with 16px gaps need a minimum of at most (1128 - 64) / 5 = 212px, so use 200px.
- **Below 1440:** wrapping is expected. Do not shrink cards until they are unreadable just to keep one row at 1280.
- **Scope:** this is a regression the shell caused, so fix it in phase 3 even in `shell` mode.

### 17a. Grid is wider than its container
- **Symptom:** horizontal page scroll at narrow widths, coming from a card grid, not from the shell.
- **Detect:** a grid with `1fr` tracks whose computed column widths add up to more than the container. A wide table or chart inside sets the track's minimum.
- **Fix:** use `minmax(0, 1fr)` instead of `1fr`, and make sure the wide child scrolls inside its own wrapper.
- **Scope:** usually present before the redesign. Check the narrow baseline. Fix in `full` mode; report in `shell` mode.

### 18. Popover inside a scrolling table is cut off
- **Symptom:** a row's popover is clipped by the table wrapper.
- **Detect:** an absolutely positioned element inside a container with `overflow-x: auto`.
- **Fix:** list it in the report. Moving the popover out of the scroll container is a behaviour change and is out of scope.

### 19. Nav shows a raw key such as `nav.reports`
- **Symptom:** one link shows a dotted key instead of a word.
- **Detect:** audit NAVIGATION marks a label `hardcoded` or a key `missing`.
- **Fix:** add the key to every locale file before using it.

### 20. Font looks different after the change
- **Symptom:** text renders in a different typeface than before.
- **Detect:** audit `fonts` says "named but NOT loaded". The app was already showing its fallback font.
- **Fix:** set `--font-sans` to the system stack. Do not add a font request.

### 20a. Escape does not close the drawer
- **Symptom:** after opening the drawer with the menu button, Escape does nothing.
- **Detect:** the keydown listener is on the sidebar element. Focus is still on the button, outside it.
- **Fix:** listen on `document`, and move focus to the first link when the drawer opens.

## Process

### 21. The redesign changes behaviour
- **Symptom:** a filter, link or request works differently.
- **Fix:** revert. This skill changes presentation only. If a visual fix needs a behaviour change, list it in the report.

### 22. Component style does not match the codebase
- **Symptom:** the new sidebar uses `<script setup>` in a codebase that uses `setup()` functions, or the reverse.
- **Detect:** audit `component API styles` and the style printed beside the shell file.
- **Fix:** write new components in the shell file's style.

### 23. Mobile is judged against a baseline that never worked
- **Symptom:** the 390px check "fails" on content that was already broken before the change.
- **Detect:** audit `@media rules` was 0 before the change.
- **Fix:** at narrow widths the target is that the shell works and content is no worse than before. Compare against the baseline screenshot.
