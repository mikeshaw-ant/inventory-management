# Design tokens

The token file is [`../assets/tokens.css`](../assets/tokens.css). This page says how to adapt it to the host app and how to replace literal values with tokens.

## Contents

1. [Rules](#rules)
2. [Deriving colours from the app](#deriving-colours-from-the-app)
3. [Snapping literals to tokens](#snapping-literals-to-tokens)
4. [Z-index mapping](#z-index-mapping)
5. [Colours outside style blocks](#colours-outside-style-blocks)
6. [What not to tokenise](#what-not-to-tokenise)

## Rules

- **Names are fixed, values are derived.** Never rename a token. Change values only where `tokens.css` says "derive".
- **Tokens live on `:root`.** Teleported modals render under `<body>`, outside the app root, and inherit nothing from it.
- **Import once, first.** Import `styles/tokens.css` from the entry file (`main.js` or `main.ts`) before any other style.
- **Adding the file changes nothing.** Phase 2 only adds and imports the file. Literals are replaced in later phases, so each visual change can be reviewed on its own.
- **If the app already has custom properties**, keep its names where they overlap in meaning and add only the missing tokens. Do not create a second name for the same value.

## Deriving colours from the app

Use the audit's `top colours` list. Keep the app's brand; do not introduce a new palette.

| Token | How to pick the value |
|---|---|
| `--color-text` | Darkest neutral used for headings |
| `--color-text-muted` | Most used mid-grey text colour |
| `--color-text-subtle` | Lightest grey still used for text (placeholders) |
| `--color-border` | Most used light grey on `border` declarations |
| `--color-border-strong` | Next darker grey used on hover or focus borders |
| `--color-bg` | Colour on `body` or the page background |
| `--color-surface` | Card and panel background, usually white |
| `--color-surface-subtle` | Light grey used for hover rows and table headers |
| `--color-primary` | Most used saturated colour that reaches 4.5:1 contrast on `--color-surface` |
| `--color-primary-hover` | One step darker than primary in the same hue |
| `--color-primary-subtle` | Lightest tint of the primary hue already in the app |
| `--color-success`, `-warning`, `-danger`, `-info` | Most used green, amber, red and blue used for status |
| `--color-*-subtle`, `--color-*-text` | The badge background and badge text pairs already in the app |
| `--font-sans` | The app's font stack, but only if the font is actually loaded (see below) |
| `--content-max-width` | The app's existing page-width value, if it has one |

**Competing shades.** When two shades of one hue compete for the same role, keep one:

- Prefer the shade that passes 4.5:1 contrast against white.
- If both pass, prefer the more used shade.
- Map every use of the other shade to the same token.

Example: an app using `#3b82f6` 22 times and `#2563eb` 21 times gets `--color-primary: #2563eb`, because `#3b82f6` on white is about 3.7:1.

**Off-palette colours.** A colour family used in only one or two places (for example a purple avatar gradient) is not part of the brand:

- In `shell` mode, leave it and list it in the report.
- In `full` mode, replace it with the primary token.

**Fonts.** If the audit says a font is "named but NOT loaded", the app already renders in the fallback font:

- Set `--font-sans` to the system stack in `tokens.css`. This preserves how the app looks today.
- Do not add a font `<link>` or package. Loading a web font is a product decision; put it in the report.

## Snapping literals to tokens

Replace a literal with the nearest token. When a literal is exactly between two steps, use the tie rule.

### Colour

Map by **role**, not by nearest shade.

| The literal is used as | Token |
|---|---|
| Heading or body text, any dark neutral | `--color-text` |
| Secondary text, table headers, any mid neutral | `--color-text-muted` |
| Placeholder or disabled text | `--color-text-subtle` |
| Border or divider | `--color-border`, or `--color-border-strong` on hover and focus |
| Page background | `--color-bg` |
| Card, panel, input background | `--color-surface` |
| Hover row, table header background | `--color-surface-subtle` |
| Status colour as a **fill**: dot, bar, icon, solid badge | `--color-success`, `-warning`, `-danger`, `-info` |
| Status colour as **text** on a light surface, such as a "+12%" trend figure | `--color-*-text` |
| Two-stop gradient within one hue | The solid token for that hue. List it in the report |
| Tinted status background, however pale | `--color-*-subtle` |
| Focus ring or glow | `--color-focus-ring`, or `0 0 0 3px var(--color-primary-subtle)` |
| Translucent black overlay or shadow colour | Keep the `rgb()` or `rgba()` literal |

**When no token fits.** Do not force it:

- If mapping would make two variants **identical** that were different before (for example a "stable" badge and an "info" badge), keep them apart. Add an app-specific token to the app's `tokens.css`, such as `--color-neutral-subtle`, and list it in the report.
- If a colour appears once and carries no meaning, map it to the nearest role.
- Never add a token to the skill's fixed scales (spacing, radius, type, layers).

### Spacing (`padding`, `margin`, `gap`)

| Literal | Token |
|---|---|
| 1px, 2px, 0.125rem | Keep the literal |
| 4px, 0.25rem, 0.313rem | `--space-1` |
| 6px, 0.375rem, 0.4rem | `--space-2` |
| 8px, 0.5rem | `--space-2` |
| 10px, 0.625rem | Tie: `--space-2` inside a control, `--space-3` between blocks |
| 12px, 0.75rem | `--space-3` |
| 14px, 0.875rem | Tie: `--space-3` inside a control, `--space-4` between blocks |
| 16px, 1rem | `--space-4` |
| 20px, 1.25rem | `--space-5` |
| 24px, 1.5rem | `--space-6` |
| 28px, 1.75rem | `--space-6` |
| 32px, 2rem | `--space-8` |
| 40px, 2.5rem | `--space-10` |
| 48px, 3rem | `--space-12` |

- "Inside a control" means buttons, inputs, selects, badges and table cells.
- Leave `0`, `auto`, percentages and negative margins as they are.
- Leave 1px and 2px as literals everywhere. Snapping them to 4px doubles the size.
- Snapping moves some values by 1 to 2px. Check controls such as selects and badges in the browser after the change.

### Type size

| Literal | Token |
|---|---|
| 11px to 12px, 0.688rem, 0.75rem | `--text-xs` |
| 13px, 0.813rem | `--text-sm` |
| 14px, 0.875rem | `--text-base` |
| 15px, 0.938rem, 0.95rem | `--text-base` for interface text, `--text-md` for paragraphs |
| 16px, 1rem | `--text-md` |
| 18px, 1.1rem, 1.125rem | `--text-lg` |
| 20px, 1.25rem | `--text-xl` |
| 22px to 24px, 1.375rem, 1.5rem | `--text-2xl` |
| 28px to 30px, 1.875rem | `--text-3xl` |
| 36px, 2.25rem | `--text-4xl` |

### Type weight

| Literal | Token |
|---|---|
| 400, `normal` | `--font-normal` |
| 500 | `--font-medium` |
| 600 | `--font-semibold` |
| 700, `bold` | `--font-bold` |

### Radius

| Literal | Token |
|---|---|
| 2px to 5px | `--radius-sm` |
| 6px to 9px | `--radius-md` |
| 10px to 16px | `--radius-lg` |
| 50% | Keep `50%` (circles) |
| 9999px, 999px | `--radius-full` |

Cards and modals use `--radius-lg`. Buttons, inputs and nav items use `--radius-md`. Badges use `--radius-md` or `--radius-full`, whichever the app already uses most.

### Shadow

| Use | Token |
|---|---|
| Resting cards, top bar | `--shadow-xs` or none (a border is enough) |
| Hovered cards, sticky bars | `--shadow-sm` |
| Dropdowns, popovers | `--shadow-md` |
| Modals, drawer | `--shadow-lg` |

Pick by use, not by matching numbers. Most apps have many one-off shadows that were never a system.

### Motion

| Literal | Token |
|---|---|
| 0.1s to 0.15s | `--duration-fast` |
| 0.2s to 0.3s | `--duration-base` (0.3s becomes slightly faster) |
| Longer than 0.3s | Keep the literal (chart or progress animation) |

## Z-index mapping

Use one ladder. Map each existing value by what the element **is**, not by its number.

| Element | Token | Value |
|---|---|---|
| Sticky cell or header inside a scroll box | `--z-raised` | 1 |
| Popover anchored inside a card or table | `--z-popover` | 10 |
| Sticky bars in the content column (filter bar) | `--z-sticky` | 100 |
| Utility bar at the top of the content column | `--z-topbar` | 200 |
| Sidebar on desktop | `--z-sidebar` | 300 |
| Drawer backdrop on mobile | `--z-backdrop` | 390 |
| Sidebar as a drawer on mobile | `--z-drawer` | 400 |
| Dropdown menus | `--z-dropdown` | 500 |
| Modal overlays | `--z-modal` | 1000 |
| Toasts | `--z-toast` | 1100 |

- **Fix ties.** If a modal and a dropdown share a value (for example both `1000`), the modal moves to `--z-modal` and the dropdown to `--z-dropdown`.
- **Check stacking contexts.** A dropdown inside the sticky utility bar is layered relative to that bar. The bar must sit above sticky bars below it, or the open menu is covered.

## Colours outside style blocks

The audit lists these under `hex outside <style>`. A stylesheet change does not reach them. Handle them in `full` mode only.

| Where the literal is | Change to |
|---|---|
| Static `style="color: #ef4444"` | A class in the style block that uses the token |
| `:style="{ color: x ? '#ef4444' : '#10b981' }"` | The same binding with `'var(--color-danger)'` and `'var(--color-success)'` |
| Hex returned from a script function, used in `:style` | Return the `var(--token)` string |
| SVG presentation attribute, `stroke="#3b82f6"` | `stroke="var(--color-primary)"`, or a class |
| Hex returned from script, bound to `:stroke` or `:fill` | Return the `var(--token)` string; keep the binding |

- `var()` works in stylesheets, in the `style` attribute and, in current browsers, in SVG presentation attributes such as `stroke="var(--x)"`.
- It does not work where the SVG is rendered outside the page: exported images, `<img src="chart.svg">`, or canvas. Leave literals there.
- Colours used in script for arithmetic or passed to a canvas API must stay literal.

## What not to tokenise

- **Chart series colours** that distinguish categories rather than encode status. Leave them, or define `--chart-1` to `--chart-6` if the same set repeats across views.
- **Values inside `calc()`** that are part of a geometry formula.
- **Sizes of fixed artwork**, such as a 200px chart or a 36px avatar.
- **Third-party embeds.**
