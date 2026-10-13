---
name: vue-saas-redesign
description: Redesign a Vue 3 app's UI shell into a modern SaaS layout. Replaces a horizontal top navigation bar with a left vertical sidebar, introduces CSS design tokens (colour, spacing, radius, shadow, z-index), normalises spacing and shared primitives across views, and adds responsive and accessibility basics, verifying each step in the browser. Presentation only - routes, API calls and business logic are not changed.
when_to_use: Use when the user asks to redesign, modernise, restyle or polish a Vue 3 front end, move navigation from a top bar to a left sidebar or side menu, build an admin or dashboard style app shell, or make spacing and colours consistent across views. Also use to audit UI inconsistency in a Vue app (mode audit). Do not use for a single-component style tweak, adding a feature or page, React, Nuxt or Vue 2 projects, or apps built on a component library such as Vuetify, Element Plus or PrimeVue.
argument-hint: "[audit|shell|full] [client-dir]"
---

# Vue SaaS redesign

Turn a Vue 3 app with a horizontal top nav into a modern SaaS interface: left sidebar, slim utility bar, design tokens, consistent spacing.

Arguments: `$ARGUMENTS`

## Modes

The first argument is the mode. The second, optional, is the Vue project or source directory.

| Mode | Phases | Changes files |
|---|---|---|
| `audit` | 0 to 1 | No |
| `shell` | 0 to 3, then 5 | Shell, sidebar, tokens, sticky bars, global styles |
| `full` (default) | 0 to 5 | The above, plus every view and component |

- No mode given: use `full`.
- If the first argument is not `audit`, `shell` or `full`, treat it as the directory and use `full`.
- No directory given: find the directory whose `package.json` depends on `vue`, then use its `src` folder. If there is more than one, ask which.

## Hard rules

1. **Presentation only.** Never change routes, API calls, stores, business logic or data. If a visual fix needs a behaviour change, stop and list it in the report. The only script the redesign adds is:
   - in the shell file: the drawer state, the skip link handler and the nav item list;
   - the icon data file;
   - the tokens import in the entry file;
   - translation keys in the locale files.
2. **Keep the brand.** Derive colours from the app's existing palette. Do not introduce a new one unless asked.
3. **No new dependencies.** No icon, CSS or component library. No web font requests.
4. **No emojis** in the interface.
5. **Follow the host project's instructions.** Read its `CLAUDE.md` first. If it requires `.vue` edits to go through a subagent, delegate every `.vue` edit using the [delegation brief](#delegating-vue-edits).
6. **Match the codebase.** Write new components in the shell file's component style, as printed by the audit.
7. **One phase, one commit** (phase 4: one commit per file). Stage explicit paths only. Never `git add -A`. Never push. Never bypass commit signing or hooks: if a commit fails, carry on uncommitted and say so in the report.
8. **Verify before moving on.** Each phase has a gate. Do not start the next phase until it passes. The agent that made an edit never runs the browser checks on it.

## Supporting files

| File | Read it |
|---|---|
| `scripts/audit.mjs` | Run in phase 1, after each phase, and in phase 5 |
| [`assets/tokens.css`](assets/tokens.css) | Copy in phase 2 |
| [`references/design-tokens.md`](references/design-tokens.md) | Before phase 2, and before phase 4 |
| [`references/layout-shell.md`](references/layout-shell.md) | Before phase 3 |
| [`references/pitfalls.md`](references/pitfalls.md) | Before phase 3. Pass to every subagent |
| [`references/icons.md`](references/icons.md) | During phase 3 |
| [`references/verification.md`](references/verification.md) | Before the first gate |

The skill directory is `${CLAUDE_SKILL_DIR}`.

## Phase 0: Preflight

1. Read the project's `CLAUDE.md` files and note any rule that affects this work.
2. Check git status **inside the client directory only**. Unrelated changes elsewhere are not a blocker. If files you will edit have uncommitted changes, stop and ask.
3. In `shell` or `full` mode, create a branch such as `redesign/saas-shell`.
4. Make sure the dev server is running, and find out how to run the production build.
5. Capture the [baseline](references/verification.md#baseline): metrics for every route, a few screenshots, and the console output.

**Gate:** dev server reachable, build command known, baseline saved.

## Phase 1: Audit

```bash
node "${CLAUDE_SKILL_DIR}/scripts/audit.mjs" <src-dir>
```

Add `--json` for complete lists, including the full colour palette.

1. **Stop conditions.** If the audit prints any `STOP:` line, stop and tell the user why. Continue only if they confirm.
2. Read the shell file and nav file the audit names, in full.
3. Read two views: the largest, and the one with the most scoped redefinitions.
4. Save the SCORECARD section and the **nav height in px**. Phase 5 compares against the scorecard.
5. Tell the user, in a few lines: what the shell is today, what will change, and what will be left alone.

If the audit prints `nav height ... not detected`, measure the old header's height in the browser and use that.

**Every later run of the audit must pass the old nav height:**

```bash
node "${CLAUDE_SKILL_DIR}/scripts/audit.mjs" <src-dir> --nav-px=<height>
```

Without it, the audit cannot find offsets still tied to the old nav once the old nav rules are gone, and it reports the new sidebar as a stop condition.

**Gate:** summary shown. **Mode `audit` ends here.**

## Phase 2: Tokens

Read [design-tokens.md](references/design-tokens.md).

1. Copy `assets/tokens.css` to `<src>/styles/tokens.css`.
2. Replace the values marked "derive" using the audit's palette and the derivation rules.
3. Import the file from the entry file, before any other style.
4. Do not replace any literal yet.

**Gate:** build passes; the app looks the same as baseline.
**Commit:** `redesign(tokens): add design tokens`

## Phase 3: Shell

Read [layout-shell.md](references/layout-shell.md) and [pitfalls.md](references/pitfalls.md).

Build the whole shell in one pass. The reference skeleton already includes the responsive and accessibility parts, so do not strip them out to add later.

1. Create the sidebar component and the icon data file.
2. Rebuild the shell template to the [target structure](references/layout-shell.md#target-structure). Replace the old root element; move modals out of the grid.
3. Move components that were mounted in the old header into the utility bar, unchanged.
4. Move each component listed under `rendered before <main>` into the main column, then fix its [offset, layer, container and wrapping](references/layout-shell.md#sticky-bars-from-the-old-layout).
5. Add the [rail and drawer](references/layout-shell.md#responsive-behaviour) rules and the drawer state.
6. Add the accessibility basics: `aria-label` on the sidebar `<nav>`, the skip link, `:focus-visible`, and the menu button attributes. `RouterLink` already sets `aria-current="page"`.
7. Add missing translation keys to **every** locale file.
8. Replace the old nav rules with the shell CSS.
9. Tokenise the global primitives (cards, tables, badges) in place. Change values only, never selector names.
10. Fix the layout regressions the sidebar caused. Compare grid rows with the baseline at 1440 on every route. Where a row of cards now wraps unevenly, adjust that grid (see [pitfall 17](references/pitfalls.md#17-a-row-of-cards-wraps-unevenly)). This is the only edit to a view that `shell` mode makes.

After this phase the shell files contain no colour literals.

**Gates**, in order:

| Gate | Checks |
|---|---|
| Build | Production build passes |
| Audit | Run with `--nav-px`. `coupledOffsets`, `duplicatedPageWidths`, `missingLocaleKeys` and `hexInShellFiles` are 0 |
| Desktop | Every route at 1440 and 1024: no new console errors, no horizontal page overflow that the baseline did not have, [shell geometry](references/verification.md#shell-geometry) and [sticky bars](references/verification.md#sticky-bars) pass. At 1440: grid rows match [baseline](references/verification.md#baseline) |
| Interaction | [Interaction checklist](references/verification.md#interaction-checklist) |
| Narrow | At 768 and 390: drawer opens and closes by button, backdrop, Escape and link. At 390: page width no larger than the 390 baseline |
| Keyboard | [Keyboard pass](references/verification.md#keyboard-pass) |

**Commit:** `redesign(shell): replace top nav with sidebar`
**Mode `shell` skips to phase 5.**

## Phase 4: Normalise views

Work **one file at a time**, starting with the file that has the most scoped redefinitions.

For each view or component:

1. Delete scoped rules that redefine a global class, so the shared rule applies.
2. Replace literal colours, spacing, type sizes, radii and shadows with tokens, using the [snapping tables](references/design-tokens.md#snapping-literals-to-tokens).
3. Replace `z-index` values using the [mapping](references/design-tokens.md#z-index-mapping).
4. Fix the width-sensitive rules the audit listed for this file.
5. Handle [colours outside style blocks](references/design-tokens.md#colours-outside-style-blocks).

Do not touch `<template>` except to move a colour from an attribute to a token. Do not touch `<script>` except to swap a colour string for a `var(--token)` string.

**Gate, per file:** build passes; screenshot at 1440 shows no broken layout; no new console errors.
**Commit, per file:** `redesign(view): normalise <FileName>`
**Phase complete** when the audit shows `scopedRedefinitions` at 0, or every remaining one is justified.

## Phase 5: Verify and report

1. Re-run the audit with `--nav-px` and compare with the phase 1 scorecard.
2. Run the [final checks](references/verification.md#gates-per-phase): screenshots, interaction checklist, scope check.
3. Write the report.

### Definition of done

| Scorecard field | `shell` | `full` |
|---|---|---|
| `coupledOffsets` | 0 | 0 |
| `duplicatedPageWidths` | 0 | 0 |
| `missingLocaleKeys` | 0 | 0 |
| `hexInShellFiles` | 0 | 0 |
| `mediaQueries` | Above 0 | Above 0 |
| `customPropertiesDefined` | Above 0 | Above 0 |
| `scopedRedefinitions` | Unchanged | 0, or each one justified |
| `hexOutsideTokenFiles` | Lower than baseline | Only the [exceptions](references/design-tokens.md#what-not-to-tokenise), each listed in the report |

Plus: build passes, no new console errors, scope check clean.

### Report format

Lead with the outcome. Then:

- **Changed:** files grouped by phase.
- **Scorecard:** before and after, as a table.
- **Verified:** what was checked in the browser, at which widths.
- **Not verified:** anything skipped, and why.
- **Left alone on purpose:** out-of-scope problems found, such as keyboard access inside dropdowns, clipped popovers, orphaned views or a font that is never loaded.
- **How to undo:** the branch name and one commit per phase, or the list of changed files if commits could not be made.

Do not say the redesign is verified unless the gates were actually run.

## Delegating `.vue` edits

Subagents do not see this skill. Give each one a complete brief:

```text
Task: <phase 3, or one file within phase 4>
Project: <absolute client dir>. Dev server: <url>.

Read first:
- <absolute path>/references/pitfalls.md
- <absolute path>/references/layout-shell.md        (phase 3)
- <absolute path>/references/icons.md               (phase 3)
- <absolute path>/references/design-tokens.md
- <src>/styles/tokens.css

Scope: edit or create only <explicit file list>.
Component style: <script-setup | setup-function | options>, matching <shell file>.

Decisions already made:
<utilities placement, brand text, link list and order, icon per link, new locale keys>

Rules:
- Presentation only: no changes to routes, API calls, stores or logic.
- Use tokens for every value. No new hex, px spacing or z-index literals.
- No new dependencies. No emojis.
- Do not run git commands.

Audit findings for these files:
<paste the relevant audit lines>

Return:
- Files changed, one line each on what changed.
- Result of the build command.
- The audit scorecard after the change.
- Anything you could not do within scope.
- Any behaviour you had to touch, and why.
```

Make the decisions yourself and state them in the brief. A subagent that has to choose the link order, the icons or the key names will choose differently each time.

## Verifying in the browser

Browser tools return a full page snapshot with every call, which fills the conversation quickly.

- Run browser gates in a **separate verifier subagent**, never the one that made the edit.
- Give it the assertions from [verification.md](references/verification.md) and the routes and widths to check.
- Ask it to return only the assertion results as JSON and the paths of saved screenshots.
- Then look at two or three of the screenshots yourself before passing the gate.

## Resuming

If the conversation is compacted or restarted:

1. Run `git log --oneline` on the redesign branch. `redesign(tokens)` and `redesign(shell)` commits mark phases 2 and 3 as done. `redesign(view)` commits show which files phase 4 has covered.
2. Re-run the audit with `--nav-px`. The scorecard shows how far the work got, including when commits could not be made.
3. Continue from the next phase or the next file.
