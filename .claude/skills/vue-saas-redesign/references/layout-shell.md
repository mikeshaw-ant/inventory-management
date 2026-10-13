# Layout shell

The target layout, and how to get there from a horizontal top nav.

## Contents

1. [Target structure](#target-structure)
2. [Shell CSS](#shell-css)
3. [Sidebar skeleton](#sidebar-skeleton)
4. [Nav items](#nav-items)
5. [Utility bar](#utility-bar)
6. [Sticky bars from the old layout](#sticky-bars-from-the-old-layout)
7. [Responsive behaviour](#responsive-behaviour)
8. [Variant: utilities in the sidebar footer](#variant-utilities-in-the-sidebar-footer)

## Target structure

```text
div.app-shell                    grid: sidebar | main column. Replaces the old root element
  a.skip-link                    first focusable element
  aside.app-sidebar              sticky, full viewport height
    div.sidebar-brand
    nav[aria-label]              ul > li > RouterLink (icon + label)
  div.sidebar-backdrop           rendered only while the drawer is open
  div.app-main                   min-width: 0
    header.app-topbar            sticky, top: 0, height: --topbar-height
      div.app-container
        button.menu-button       drawer mode only
        div.topbar-title         optional
        div.topbar-actions       language switcher, profile menu
    [sticky bars]                moved from the old layout, top: --topbar-height
    main#main-content.app-content
      div.app-container
        <router-view>
[modals]                         after the grid, never inside it
```

Four decisions hold this together:

- **The page scrolls on `body`, not inside the main column.** Existing `position: sticky` elements keep working, and nothing needs `overflow: auto`.
- **The main column has `min-width: 0`.** Without it, one wide table stretches the grid and pushes the page sideways.
- **One container class sets width and gutters.** The top bar, sticky bars and page content all use it, so their edges line up.
- **The grid has exactly two children in flow:** the sidebar and the main column. Anything else that is a direct child must be `position: fixed` or `absolute`, or it takes a grid cell and pushes the main column down.

When rebuilding the shell template:

- **Replace the old root element**, do not wrap it. A flex-column root with the grid nested inside breaks the page height.
- **Move modals out of the grid.** If the old root rendered modal components as children, place them after the closing tag of `.app-shell`. A Vue 3 template may have more than one root element.
- **Remove the old content wrapper's rules** (for example `.main-content`) when adding `main#main-content`. If both apply, the padding doubles.
- **Check `html`, `body` and `#app` for `overflow`.** `overflow-x: hidden` on any of them breaks `position: sticky`. Remove it, or use `overflow-x: clip`.

## Shell CSS

Put this in the shell file's global style block, or in `styles/shell.css` imported after `tokens.css`.

```css
/* On body, not on the shell, so that teleported modals inherit it too. */
body {
  font-family: var(--font-sans);
  background: var(--color-bg);
  color: var(--color-text);
}

.app-shell {
  display: grid;
  grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
  min-height: 100vh;
}

.app-main {
  min-width: 0; /* lets wide tables scroll inside their own container */
  display: flex;
  flex-direction: column;
}

/* Shared by the top bar, sticky bars and page content so their edges align. */
.app-container {
  width: 100%;
  max-width: var(--content-max-width);
  margin-inline: auto;
  padding-inline: var(--content-padding-x);
}

.app-topbar {
  position: sticky;
  top: 0;
  z-index: var(--z-topbar);
  height: var(--topbar-height);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.app-topbar > .app-container {
  height: 100%;
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.topbar-title {
  font-size: var(--text-md);
  font-weight: var(--font-semibold);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.topbar-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.app-content {
  flex: 1;
  padding-block: var(--content-padding-y);
}

.menu-button {
  display: none; /* shown in drawer mode */
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text-muted);
  cursor: pointer;
}

/* Icons rendered in the shell file. The sidebar styles its own, scoped. */
.shell-icon {
  width: 1.25rem;
  height: 1.25rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* Hidden by default so it never takes a grid cell on wide screens. */
.sidebar-backdrop {
  display: none;
}

.skip-link {
  position: absolute;
  left: var(--space-2);
  top: var(--space-2);
  z-index: var(--z-toast);
  padding: var(--space-2) var(--space-3);
  background: var(--color-surface);
  border-radius: var(--radius-md);
  transform: translateY(-200%);
}

.skip-link:focus {
  transform: none;
}

:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}

/* The skip link focuses <main>. Without this the whole page gets a ring. */
.app-content:focus-visible {
  outline: none;
}
```

Skip link markup:

```vue
<a class="skip-link" href="#main-content" @click.prevent="skipToContent">Skip to content</a>
...
<main id="main-content" class="app-content" tabindex="-1">
```

```js
// Focus <main> without following the anchor. Following it would scroll the
// page heading underneath the sticky bars, and would change the URL, which
// breaks hash-mode routing.
const skipToContent = () => {
  document.getElementById('main-content')?.focus({ preventScroll: true })
}
```

- `tabindex="-1"` lets the handler move keyboard focus to `<main>`.
- Keep the `href`. It is the fallback if the script fails, and it tells assistive technology where the link goes.
- Translate the link text if the app has i18n.

**Headings.** The brand text in the sidebar is not a heading. If the old header used `<h1>` for the brand, the shell no longer has one. Leave the views' own headings as they are and note the change in the report.

Delete the old rules for the top nav, its container, its tabs and the active underline. Delete parent-reaches-into-child rules such as `.nav-container > .language-switcher`; they stop matching once the component moves.

## Sidebar skeleton

**Adapt this, do not paste it.** Write the component in the same API style as the shell file. The audit prints that style (`script-setup`, `setup-function` or `options`).

```vue
<template>
  <aside id="app-sidebar" class="app-sidebar" :class="{ 'is-open': open }">
    <div class="sidebar-brand">
      <span class="sidebar-brand-mark" aria-hidden="true">{{ brandName.charAt(0) }}</span>
      <span class="sidebar-brand-text">
        <span class="sidebar-brand-name">{{ brandName }}</span>
        <span v-if="brandTagline" class="sidebar-brand-tagline">{{ brandTagline }}</span>
      </span>
    </div>

    <nav class="sidebar-nav" :aria-label="navLabel">
      <ul class="sidebar-list">
        <li v-for="item in items" :key="item.to">
          <RouterLink :to="item.to" class="sidebar-link" :title="item.label" @click="$emit('close')">
            <svg class="sidebar-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path v-for="d in item.icon" :key="d" :d="d" />
            </svg>
            <span class="sidebar-label">{{ item.label }}</span>
          </RouterLink>
        </li>
      </ul>
    </nav>
  </aside>
</template>

<script setup>
defineProps({
  items: { type: Array, required: true }, // [{ to, label, icon: string[] }]
  brandName: { type: String, required: true },
  brandTagline: { type: String, default: '' },
  navLabel: { type: String, default: 'Main' },
  open: { type: Boolean, default: false }, // drawer mode only
})
defineEmits(['close'])
</script>

<!-- The same script for a codebase that uses setup() functions or the Options API:
<script>
export default {
  name: 'AppSidebar',
  props: {
    items: { type: Array, required: true },
    brandName: { type: String, required: true },
    brandTagline: { type: String, default: '' },
    navLabel: { type: String, default: 'Main' },
    open: { type: Boolean, default: false },
  },
  emits: ['close'],
}
</script>
-->

<style scoped>
.app-sidebar {
  position: sticky;
  top: 0;
  align-self: start;
  height: 100vh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--sidebar-bg);
  border-right: 1px solid var(--sidebar-border);
  z-index: var(--z-sidebar);
}

.sidebar-brand {
  position: relative; /* containing block for the hidden text in rail mode */
  display: flex;
  align-items: center;
  gap: var(--space-3);
  height: var(--topbar-height); /* lines up with the top bar's bottom border */
  padding-inline: var(--space-4);
  border-bottom: 1px solid var(--sidebar-border);
  flex-shrink: 0;
}

.sidebar-brand-mark {
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  flex-shrink: 0;
  border-radius: var(--radius-md);
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-weight: var(--font-bold);
}

.sidebar-brand-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: var(--leading-tight);
}

.sidebar-brand-name {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--sidebar-fg-strong);
}

.sidebar-brand-tagline {
  font-size: var(--text-xs);
  color: var(--sidebar-fg);
}

.sidebar-brand-name,
.sidebar-brand-tagline {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-nav {
  flex: 1;
  overflow-y: auto; /* only the link list scrolls, never the whole sidebar */
  padding: var(--space-3);
}

.sidebar-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.sidebar-link {
  position: relative; /* containing block for the hidden label in rail mode */
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  color: var(--sidebar-fg);
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  text-decoration: none;
  transition: background var(--duration-fast) var(--ease-standard),
    color var(--duration-fast) var(--ease-standard);
}

.sidebar-link:hover {
  background: var(--sidebar-item-hover-bg);
  color: var(--sidebar-fg-strong);
}

/* RouterLink sets aria-current="page" on the exact active route. */
.sidebar-link[aria-current='page'] {
  background: var(--sidebar-item-active-bg);
  color: var(--sidebar-item-active-fg);
}

.sidebar-icon {
  width: 1.25rem;
  height: 1.25rem;
  flex-shrink: 0;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.sidebar-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
```

Notes for adapting:

- **Component style.** With a `setup()` function or the Options API, `defineProps` becomes `props:` and `defineEmits` becomes `emits: ['close']`. `$emit` in the template works in every style.
- **`RouterLink` needs no import.** `app.use(router)` registers it globally. `<router-link>` and `<RouterLink>` are the same component.
- **Scoped styles reach the link.** `RouterLink` renders one root `<a>`, which receives the sidebar's scope id and the `sidebar-link` class.
- **Class names.** Prefix everything with `sidebar-`. Apps often have global rules for generic names such as `.logo`, `.subtitle` or `.card` that would leak in.
- **Nested routes.** `aria-current="page"` matches the exact route only. If a section should stay highlighted on its child routes, also style `.router-link-active`.
- **Old active binding.** Remove a manual `:class="{ active: $route.path === ... }"` binding. `RouterLink` already marks the active link.
- **`title` on links.** It gives rail mode a tooltip on hover. The label stays in the DOM, so the accessible name is unchanged.
- **Icon paths must be unique within one icon**, because each path string is used as its `v-for` key.

## Nav items

Build the list in the shell file so that labels stay reactive to the app's i18n.

```js
import { navIcons } from './components/navIcons' // adjust to where the file was saved

const navItems = computed(() => [
  { to: '/', label: t('nav.overview'), icon: navIcons.dashboard },
  { to: '/inventory', label: t('nav.inventory'), icon: navIcons.box },
])
```

- **Keep the existing links, order and labels.** Take them from the audit's NAVIGATION section. Do not add, remove, rename or reorder destinations.
- **Hardcoded labels.** If the other labels are translated and one is hardcoded, add a key for it to **every** locale file and use it. Check how the app's `t()` behaves on a missing key first; many return the raw key.
- **Icons.** Choose by route keyword from [icons.md](icons.md). Every item gets an icon, or none do.
- **Grouping.** Do not invent section headings for fewer than about eight links.

## Utility bar

A slim bar at the top of the main column holds whatever used to sit beside the nav links: language switcher, profile menu, search, notifications.

- Components mounted in the old header move here unchanged. Their dropdowns open downward and right-aligned, which still works at the right edge of this bar.
- A page title on the left is optional. Add it only when the views do not already render their own page heading, otherwise the title appears twice.
- The bar's height is `--topbar-height`. The sidebar brand row uses the same height so the two bottom borders form one line.

## Sticky bars from the old layout

The audit lists these under `rendered before <main>` and `offsets tied to nav`.

1. Move the component inside `div.app-main`, between the top bar and `<main>`.
2. Change its offset from the old nav height to `top: var(--topbar-height)`.
3. Change its `z-index` to `var(--z-sticky)`.
4. Add the shared `app-container` class to its inner wrapper, and delete that wrapper's own `max-width`, `margin` and side padding. A global class applies inside a scoped component.
5. Let its controls wrap: add `flex-wrap: wrap` to **every** flex row between the bar and its controls, not only the outermost one.

## Responsive behaviour

| Width | Sidebar | Grid columns |
|---|---|---|
| Above 1024px | Full, icons and labels | `var(--sidebar-width) minmax(0, 1fr)` |
| 769px to 1024px | Rail, icons only | `var(--sidebar-width-rail) minmax(0, 1fr)` |
| 768px and below | Off-canvas drawer | `minmax(0, 1fr)` |

Shell rules:

```css
@media (max-width: 1024px) {
  .app-shell {
    grid-template-columns: var(--sidebar-width-rail) minmax(0, 1fr);
  }
}

@media (max-width: 768px) {
  .app-shell {
    grid-template-columns: minmax(0, 1fr);
  }
  .menu-button {
    display: inline-flex;
  }
  .sidebar-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    z-index: var(--z-backdrop);
    background: rgb(15 23 42 / 0.4);
  }
}
```

Sidebar rules, inside the sidebar component. Keep the two blocks in this order: the drawer block must come last so that it overrides the rail block.

```css
@media (max-width: 1024px) {
  /* Rail: hide labels visually but keep them for screen readers. */
  .sidebar-label,
  .sidebar-brand-text {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    border: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .sidebar-brand,
  .sidebar-link {
    justify-content: center;
    padding-inline: 0;
  }
}

@media (max-width: 768px) {
  /* Drawer: full sidebar again, off-canvas until opened. */
  .app-sidebar {
    position: fixed;
    inset: 0 auto 0 0;
    width: var(--sidebar-width);
    z-index: var(--z-drawer);
    box-shadow: var(--shadow-lg);
    transform: translateX(-100%);
    visibility: hidden; /* keeps closed links out of the tab order */
    transition: transform var(--duration-base) var(--ease-standard), visibility 0s linear var(--duration-base);
  }
  .app-sidebar.is-open {
    transform: none;
    visibility: visible;
    transition-delay: 0s;
  }
  /* Undo every declaration of the rail block. */
  .sidebar-label,
  .sidebar-brand-text {
    position: static;
    width: auto;
    height: auto;
    margin: 0;
    overflow: visible;
    clip-path: none;
    white-space: normal;
  }
  .sidebar-label {
    overflow: hidden; /* restore the base ellipsis */
    white-space: nowrap;
  }
  /* Restore each element's own base padding: they differ. */
  .sidebar-brand {
    justify-content: flex-start;
    padding-inline: var(--space-4);
  }
  .sidebar-link {
    justify-content: flex-start;
    padding-inline: var(--space-3);
  }
}
```

### Drawer behaviour

The drawer is the only part that needs new state. Keep it to this, in the shell file:

```js
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'

const drawerOpen = ref(false)
const menuButton = ref(null)

const closeDrawer = () => {
  if (!drawerOpen.value) return
  drawerOpen.value = false
  nextTick(() => menuButton.value?.focus()) // return focus to where the user was
}

// Listen on the document: after clicking the menu button, focus is on the
// button, outside the sidebar, so a listener on the sidebar would not fire.
const onKeydown = (event) => {
  if (event.key === 'Escape') closeDrawer()
}
onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))

// Move focus into the drawer when it opens, so the next Tab is a nav link.
watch(drawerOpen, async (open) => {
  if (!open) return
  await nextTick()
  document.querySelector('#app-sidebar .sidebar-link')?.focus()
})
```

```vue
<button
  ref="menuButton"
  class="menu-button"
  type="button"
  aria-controls="app-sidebar"
  :aria-expanded="drawerOpen"
  :aria-label="t('nav.openMenu')"
  @click="drawerOpen = true"
>
  <svg class="shell-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path v-for="d in navIcons.menu" :key="d" :d="d" />
  </svg>
</button>

<div v-if="drawerOpen" class="sidebar-backdrop" @click="closeDrawer"></div>
```

- With a `setup()` function, return `drawerOpen`, `menuButton`, `closeDrawer` and `navIcons` so the template can use them.
- Pass `:open="drawerOpen"` and `@close="closeDrawer"` to the sidebar.
- If the app has no i18n, use a plain `aria-label="Open navigation"`. If it has, add the key to every locale file.
- The drawer state and the skip link handler are the only script additions the redesign makes. They add shell behaviour and do not touch app logic.
- While the drawer is open it covers the menu button. Backdrop, Escape and choosing a link close it. Add a close button inside the drawer only if the user asks.

Do not add a desktop collapse toggle or remember state in `localStorage` unless the user asks.

## Variant: utilities in the sidebar footer

Use only when the user asks for profile or language controls in the sidebar. It costs more:

- Menus must open **upward** and **left-aligned**: `bottom: calc(100% + var(--space-2)); left: 0; top: auto; right: auto`.
- A menu wider than the sidebar needs `max-width` or must be allowed to overflow to the right. The sidebar must not have `overflow: hidden`.
- In rail mode the footer shows the avatar only, and the menu opens to the right of the rail.
- With no utility bar, sticky bars use `top: 0` and the drawer's menu button needs a small fixed header of its own on mobile.
