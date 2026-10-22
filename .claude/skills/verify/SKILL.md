---
name: verify
description: How to verify UI changes in this app by driving it in a real browser.
---

# Verify

Start the servers (`cd server && uv run python main.py`, `cd client && npm run dev`), then observe the app at http://localhost:3000.

## Driving the UI

Prefer the Playwright MCP tools. If they are unavailable, script headless Chrome directly:

1. Launch Chrome with `--headless=new --remote-debugging-port=9333 --user-data-dir=<temp dir>`. Never use a real profile.
2. From Node, fetch `http://127.0.0.1:9333/json` and open the page's `webSocketDebuggerUrl`.
3. Use `Emulation.setDeviceMetricsOverride` for widths, `Runtime.evaluate` to measure, `Page.captureScreenshot` to capture.
4. Kill the Chrome process afterwards, including after a timeout.

## What to check

- Page overflow is 0 on every route (`/`, `/inventory`, `/orders`, `/spending`, `/demand`, `/reports`) at 1440, 1024, 768 and 390: `scrollWidth - clientWidth`.
- Drawer at 390: opens by button; closes by Escape, backdrop and link.
- Modals: Tasks and Profile Details from the profile menu, Cost from a `.stacked-bar` on `/spending`, Backlog from a shortage row on `/`, Inventory from a row on `/inventory`, Product from a top products row on `/`.
- Language switch to Japanese relabels the sidebar.
- Look at the screenshots. Build and audit checks do not catch collapsed or invisible elements.

## Gotchas

- `--window-size` has a minimum of about 500px, so narrower screenshots are cropped. Use the device metrics override.
- Dispatch real mouse events with `Input.dispatchMouseEvent`. A synthetic `.click()` does not open the profile menu items or close dropdowns.
- Clicking a transaction row on `/spending` calls `alert()`, which hangs the script unless `Page.handleJavaScriptDialog` answers it.
- Vite returns 200 with `index.html` for missing paths, so check response content, not status.
- Known console noise: a `PurchaseOrderModal` resolve warning and a failed `/api/tasks` load.
