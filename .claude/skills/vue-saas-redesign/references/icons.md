# Navigation icons

A small set of original outline icons, so the sidebar needs no icon library.

- 24 by 24 viewBox, drawn with strokes only.
- Rendered with `fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round`.
- Each icon is a list of path `d` strings. The sidebar renders one `<path>` per string.

**If the app already has an icon library** (the audit prints `icon libraries`), use that library instead and skip this file.

## Icon data

Save as `navIcons.js` (or `.ts`) next to the sidebar component. The shell file imports it from there, for example `import { navIcons } from './components/navIcons'`.

```js
// Outline icons for the sidebar: 24x24 viewBox, stroke only.
export const navIcons = {
  dashboard: ['M4 4h7v9H4z', 'M13 4h7v5h-7z', 'M13 11h7v9h-7z', 'M4 15h7v5H4z'],
  home: ['M3.5 11L12 4l8.5 7', 'M5.5 9.5V20h13V9.5', 'M10 20v-6h4v6'],
  box: ['M12 3l8 4.5v9L12 21l-8-4.5v-9z', 'M4 7.5l8 4.5 8-4.5', 'M12 12v9'],
  clipboard: ['M9 3.5h6v3H9z', 'M9 5H6v15.5h12V5h-3', 'M9 11h6', 'M9 15h6'],
  card: ['M3 6h18v12H3z', 'M3 10h18', 'M6.5 14.5h4'],
  trending: ['M3 17l6-6 4 4 8-8', 'M15 7h6v6'],
  bars: ['M4 20h16', 'M7 20v-7', 'M12 20V5', 'M17 20V10'],
  file: ['M6 3h8l4 4v14H6z', 'M14 3v4h4', 'M9 12h6', 'M9 16h6'],
  users: [
    'M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7z',
    'M2.5 20c0-3 2.9-5.5 6.5-5.5s6.5 2.5 6.5 5.5',
    'M16 4.2a3.5 3.5 0 010 6.6',
    'M18 14.8c2 .7 3.5 2.6 3.5 5.2',
  ],
  user: ['M12 11a4 4 0 100-8 4 4 0 000 8z', 'M4 21c0-3.9 3.6-7 8-7s8 3.1 8 7'],
  truck: [
    'M2.5 6h11v10h-11z',
    'M13.5 9h4l3 3.5V16h-7z',
    'M7 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3z',
    'M17 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3z',
  ],
  tag: ['M3.5 12.5v-8h8l9 9-8 8z', 'M7.5 8.5h.01'],
  calendar: ['M4 6h16v14H4z', 'M4 10h16', 'M8 3.5v4', 'M16 3.5v4'],
  list: ['M8 6h12', 'M8 12h12', 'M8 18h12', 'M4 6h.01', 'M4 12h.01', 'M4 18h.01'],
  bell: ['M6 16v-5a6 6 0 0112 0v5l1.5 2h-15z', 'M10 20.5h4'],
  settings: ['M4 7h9', 'M17 7h3', 'M15 5v4', 'M4 17h3', 'M11 17h9', 'M9 15v4'],
  circle: ['M12 4a8 8 0 100 16 8 8 0 000-16z'],
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
}
```

## Choosing an icon

Match on the route path first, then on the English label. Use the first row that matches.

| Route or label contains | Icon |
|---|---|
| `/` exactly, dashboard, overview, summary | `dashboard` |
| home, start | `home` |
| inventory, stock, warehouse, items | `box` |
| product, catalog, sku | `tag` |
| order, purchase, request, task-list | `clipboard` |
| finance, spending, billing, payment, invoice, cost | `card` |
| demand, forecast, trend, growth | `trending` |
| report, analytics, insight, metric, stat | `bars` |
| document, file, logs, audit | `file` |
| customer, team, people, member, contact | `users` |
| profile, account | `user` |
| supplier, vendor, shipping, delivery, logistics | `truck` |
| schedule, calendar, planning | `calendar` |
| task, todo, backlog, queue | `list` |
| notification, alert | `bell` |
| setting, preference, config, admin | `settings` |
| anything else | `circle` |

`menu` is for the drawer button. `close` is only needed if you add a close button inside the drawer. Neither is a nav item.

Copy only the icons you use into the app.

## Rules

- **Every item gets an icon, or none do.** A mixed list looks broken in rail mode, where the icon is all that shows.
- **No two items share an icon.** If two routes match the same row, give the second its next best match.
- **Icons are decorative.** Render them with `aria-hidden="true"`. The label carries the name.
- **No emoji and no icon fonts.**
- **Do not restyle the app's existing icons** in other components. They are outside the shell.
