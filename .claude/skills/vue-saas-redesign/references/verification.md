# Verification

How to prove each phase worked. Most Vue apps have no frontend tests, so the browser is the test.

Use the project's browser automation (for example Playwright MCP tools). If none is available, see [No browser automation](#no-browser-automation).

## Contents

1. [Gates per phase](#gates-per-phase)
2. [Keeping browser output small](#keeping-browser-output-small)
3. [Baseline](#baseline)
4. [Screenshot matrix](#screenshot-matrix)
5. [Browser assertions](#browser-assertions)
6. [Interaction checklist](#interaction-checklist)
7. [Keyboard pass](#keyboard-pass)
8. [Scope check](#scope-check)
9. [No browser automation](#no-browser-automation)

## Gates per phase

| After phase | Run |
|---|---|
| 0 Preflight | Baseline |
| 2 Tokens | Build. Route metrics match baseline |
| 3 Shell | Build. Audit. Assertions on every route at 1440 and 1024. Interaction checklist. Drawer checks at 768 and 390. Keyboard pass |
| 4 Normalise | Build and one screenshot per view, straight after that view's change |
| 5 Final | Re-run the audit. Full matrix. Interaction checklist. Scope check |

"Build" is the project's production build, for example `npm run build`. It is the cheapest way to catch a broken import or template.

## Keeping browser output small

Browser automation tools return a snapshot of the whole page, and the console log, with every call. A handful of calls can fill the conversation.

- **Use a verifier subagent.** It runs the checks and returns only results. It must not be the agent that made the edit.
- **Check all routes in one call.** In a single-page app, click each nav link inside one evaluate call and collect the numbers. See [Baseline](#baseline).
- **Save screenshots to files.** Look at two or three; do not load them all.
- **Ask for JSON back**, not prose.

## Baseline

Capture before any change, at **1440 and at 390** wide.

Adjust the selectors to the app first: `nav a[href]` for the links, and `main` for the content area. If the old layout has no `<main>` element, use the element that wraps the router view. With the wrong selectors the script returns empty results and the comparison means nothing.

```js
async () => {
  // Rows are counted from where the items actually sit. Track counts are not
  // reliable: an auto-fit grid reports empty tracks as columns. An item starts
  // a new row only when it sits below the row before it, so items of
  // different heights that are centred in one row still count as one row.
  const rowsOf = (el) => {
    const rows = []
    for (const child of el.children) {
      const r = child.getBoundingClientRect()
      const last = rows.at(-1)
      if (last && r.top < last.bottom - 1) {
        last.items++
        last.bottom = Math.max(last.bottom, r.bottom)
      } else {
        rows.push({ bottom: r.bottom, items: 1 })
      }
    }
    return { items: el.children.length, rows: rows.length, lastRowItems: rows.at(-1)?.items ?? 0 }
  }
  const links = [...document.querySelectorAll('nav a[href]')]
  const out = {}
  for (const href of links.map((a) => a.getAttribute('href'))) {
    document.querySelector(`nav a[href="${href}"]`).click()
    await new Promise((resolve) => setTimeout(resolve, 900)) // wait for data to load
    out[href] = {
      heading: document.querySelector('main h1, main h2')?.textContent.trim(),
      scrollWidth: document.documentElement.scrollWidth,
      pageHeight: document.documentElement.scrollHeight,
      stillLoading: !!document.querySelector('main .loading, main .error'),
      // Row layout of every grid in the page content: catches rows that wrap
      // differently once the sidebar takes its share of the width.
      grids: [...document.querySelectorAll('main *')]
        .filter((el) => getComputedStyle(el).display === 'grid' && el.children.length > 1)
        .map((el) => ({ cls: el.className, ...rowsOf(el) })),
    }
  }
  return { viewport: [innerWidth, innerHeight], routes: out }
}
```

Also record:

- The console errors and warnings on first load. Many apps have some before you start. Only **new** ones fail a gate.
- Screenshots from the [matrix](#screenshot-matrix).

After the redesign, run the same call and compare:

| Field | At 1440 | At 390 |
|---|---|---|
| `heading` | Same as baseline | Same as baseline |
| `stillLoading` | `false` | `false` |
| `scrollWidth` | Equal to the viewport width | No larger than baseline |
| `grids[].rows` | Same as baseline. If a grid gained a row, `lastRowItems` must not be 1 | Not compared |

A grid whose last row has one item in the **baseline** too is fine: it is usually a deliberate full-width item.

An app with no responsive rules usually overflows at 390 before the redesign. That is why the narrow baseline matters: without it you cannot tell a regression from an existing problem.

## Screenshot matrix

Screenshots are for you to compare; assertions decide pass or fail. Keep the set small.

| Width | Routes | When |
|---|---|---|
| 1440 | Every route | Baseline and final |
| 1024 | Two routes: the busiest dashboard and the widest table | Baseline and final |
| 768 | The same two | Final |
| 390 | The same two | Baseline and final |

- Save to a folder that git ignores. Never commit screenshots.
- Name files `<phase>-<route>-<width>.png` so before and after sort together.
- Wait for data to load before capturing. An app that fetches on mount shows a loading state first.

## Browser assertions

Run in the page with the browser tool's evaluate function. Each returns an object; check the fields named below.

### Shell geometry

```js
() => {
  const q = (s) => document.querySelector(s)
  const rect = (el) => (el ? el.getBoundingClientRect() : null)
  const sidebar = rect(q('.app-sidebar'))
  const topbar = rect(q('.app-topbar'))
  const main = rect(q('main'))
  return {
    viewport: [innerWidth, innerHeight],
    pageOverflowsX: document.documentElement.scrollWidth > innerWidth,
    sidebar: sidebar && { left: sidebar.left, width: sidebar.width, height: sidebar.height },
    topbar: topbar && { left: topbar.left, top: topbar.top, height: topbar.height },
    mainLeft: main && main.left,
    oldNavPresent: !!q('.top-nav, .navbar, header nav'),
  }
}
```

Pass when:

- `pageOverflowsX` is `false`.
- Above 768px: `sidebar.left` is 0, `sidebar.height` equals the viewport height, and `topbar.left` equals `sidebar.width`.
- `oldNavPresent` is `false`. Adjust the selector to the old nav's class from the audit.

### Sticky bars

Scroll first, then measure.

```js
() => {
  window.scrollTo(0, 600)
  const topbar = document.querySelector('.app-topbar').getBoundingClientRect()
  // Replace with the selector of each bar the audit listed under "rendered before <main>".
  const bar = document.querySelector('.filters-bar').getBoundingClientRect()
  return { topbarTop: topbar.top, topbarBottom: topbar.bottom, barTop: bar.top, scrolled: window.scrollY }
}
```

Pass when `scrolled` is above 0, `topbarTop` is 0, and `barTop` equals `topbarBottom` within 1px.

If `scrolled` is 0 the page is too short to scroll at this size. Use a route with more content.

### Alignment

```js
() => {
  const left = (s) => {
    const el = document.querySelector(s)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return Math.round(r.left + parseFloat(getComputedStyle(el).paddingLeft))
  }
  return {
    topbar: left('.app-topbar > .app-container'),
    content: left('main > .app-container'),
    // Add each sticky bar's inner container, for example:
    // filters: left('.filters-bar .app-container'),
  }
}
```

Pass when the values are equal.

### Open menu inside the viewport

Open the menu with a click, then:

```js
() => {
  // Replace with the open menu's selector.
  const r = document.querySelector('.dropdown-menu').getBoundingClientRect()
  return {
    inside: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
    rect: [r.left, r.top, r.right, r.bottom].map(Math.round),
  }
}
```

Pass when `inside` is `true`. Then take a screenshot and confirm nothing covers the menu.

### Console

Read the browser console after loading each route.

- **New** errors or Vue warnings fail the gate.
- Errors that were already in the baseline do not. Record the baseline console output in phase 0 so you can tell them apart.

## Interaction checklist

Run once after phase 3 and again at the end.

- [ ] Every nav link goes to its route and becomes the highlighted item.
- [ ] Exactly one item is highlighted on every route.
- [ ] Each dropdown in the utility bar opens, is fully visible, and closes.
- [ ] Each modal opens above the sidebar and the top bar, and closes.
- [ ] Each filter or control in a moved sticky bar still changes the data.
- [ ] Switching language updates the sidebar labels.
- [ ] At 768px and below: the menu button opens the drawer; backdrop, Escape and choosing a link each close it.

## Keyboard pass

With no mouse, starting from a fresh page load:

1. First Tab focuses the skip link, and it is visible.
2. Enter on the skip link moves focus to the main content, and the page heading is still visible, not hidden under a sticky bar.
3. Tab reaches every sidebar link, in visual order, each with a visible focus ring.
4. Enter on a sidebar link navigates.
5. Tab reaches the controls in the utility bar.
6. At 768px and below: the menu button is reachable, Enter opens the drawer, Escape closes it and focus returns to the button.

Record, but do not fix, keyboard failures inside dropdowns and modals. Those need behaviour changes and are out of scope.

## Scope check

```bash
git diff --stat <base-branch>
git status --short
```

The first command compares the working tree with the base branch, so it covers committed and uncommitted work. The second catches new files that are not tracked yet.

Fail if the changes touch any of:

- Server or API code.
- The API client module.
- Route definitions: paths, components, guards.
- Stores, composables or utilities, except adding translation keys to locale files.
- `package.json` dependencies.

## No browser automation

If no browser tool is available:

1. Run the build after every phase.
2. Re-run the audit and compare the scorecard.
3. Say plainly in the report that nothing was verified in a browser.
4. Give the user the interaction checklist and keyboard pass to run by hand.

Do not claim the redesign is verified.
