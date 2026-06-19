# Decision Map — Tableau Dashboard Extension

A dashboard extension that reads a worksheet of **staged state columns**
(`i_state → 1_state → 2_state → 3_state`) and draws a left-to-right
**decision tree**. Each row (e.g. a horse) is one path through the stages;
identical sub-paths are merged and counted.

- **Node** = a stage value (`retired`, `a`, `b`, …).
- **Edge label** = how many rows took that branch.
- **Edge thickness** = scales with that count.
- **Empty / skipped stage** = no *visible* node. The blank is kept internally as
  an invisible placeholder so the value after it stays in its real stage column
  (stage levels stay aligned) — the link just routes through the empty column.
  Trailing blanks (a row that simply ended) are dropped.
- Nodes are keyed by their full path, so a `d` at stage 2 and a `d` at stage 3
  stay separate — the map is always a clean tree, never a re-merging graph.

```
retired ─┬─ b ×3 ─┬─ c ×2 ── d ×2
         │        └─ d ×1 ── f ×1
         └─ a ×5
```

## Data shape (wide / one row per entity)

| horse_no | i_state | 1_state | 2_state | 3_state |
|----------|---------|---------|---------|---------|
| A001 | retired | b | c | d |
| A002 | retired | a |   |   |
| A006 | retired | b | d | f |

Only columns matching `i_state` or `<n>_state` drive the map; everything else
(`retirement`, `1a`, `1b`, …) is ignored. The stage order is auto-detected
(`i_state` first, then numeric ascending) and can be overridden in **Configure**.

## Project layout

| File | Purpose |
|------|---------|
| `decision-map.trex` | The manifest you add to a Tableau dashboard (points at `http://localhost:8080/index.html`). |
| `serve.py` | Python 3 dev server (no dependencies) — serves the folder with no-cache headers. |
| `index.html` | Extension UI (toolbar + SVG canvas). |
| `preview.html` | **Standalone** preview with inline sample data — renders the tree with no Tableau. Open it in a browser to iterate the visual. |
| `preview-skip.html` | Standalone demo of skipped/empty stages (stage levels kept, placeholders invisible). |
| `js/build-tree.js` | Pure data shaping: wide rows → paths → counted prefix tree. |
| `js/render-tree.js` | Pure D3 renderer (counted tree → SVG). |
| `js/decision-map.js` | Tableau glue: read worksheet, resolve stage columns, build + render. |
| `configure.html` / `js/configure.js` | Gear-menu dialog (pick worksheet + stage columns). |
| `lib/` | Vendored Extensions API + D3 (no CDN dependency). |
| `sample-data/stage-data.csv` | Demo data matching the table above. |
| `sample-data/test-logic.js` | `node sample-data/test-logic.js` — tests the builder against the CSV. |

## Run it (Tableau Desktop)

1. **Serve the folder** with the bundled Python dev server (the manifest URL
   must resolve). It needs only Python 3 — no `npm install` — and sends no-cache
   headers so your edits show on reload:
   ```bash
   cd ~/Projects/TablueExt
   python3 serve.py            # http://localhost:8080  (python3 serve.py 8090 for another port)
   ```
   Equivalent without the script: `python3 -m http.server 8080`.
   Sanity-check the visual with no Tableau at all:
   <http://localhost:8080/preview.html>

2. **Build a worksheet** from `sample-data/stage-data.csv` (or your data). Put
   `i_state, 1_state, 2_state, 3_state` (and `horse_no`) on **Detail** so every
   row is returned. A text table works fine.

3. **Add the extension:** Dashboard → drag **Extension** onto the canvas →
   *Access Local Extensions* → pick `decision-map.trex` → allow it.

4. The tree renders. Use the **gear menu → Configure** to choose the worksheet
   and stage-column order.

## How the counts / thickness work

`js/build-tree.js` folds the rows into a prefix tree; each node's `count` is the
number of rows passing through it. `js/render-tree.js` puts that count on the
incoming edge and scales the stroke width with `d3.scaleSqrt`.

## Do I need to run a server?

Yes — a dashboard extension is a web app, and Tableau loads it live from the
`<url>` in the `.trex` every time the dashboard opens. There's no "load from a
file" option. But the scale depends on who uses it:

- **Just you, Tableau Desktop:** the server is `python3 serve.py` on your own
  machine — `http://localhost:8080`. Tableau allows plain HTTP for
  `localhost`/`127.0.0.1`. It only needs to be running while you use the
  dashboard; stop it and the extension goes blank.
- **Others / Tableau Server / Tableau Cloud:** the files must be hosted somewhere
  that stays up and is reachable over **HTTPS** (see below).

Your worksheet data never travels to that host — the Extensions API reads data
inside Tableau's client. The host only serves static HTML/JS/CSS.

## Deploying to Tableau Server / Cloud

The host must (1) serve over **HTTPS** with a valid cert (Tableau allows plain
HTTP only for localhost), (2) stay running and be reachable by Tableau Server and
each user's browser, and (3) **not** sit behind an interactive login like HTTP
Basic Auth — the extension frame can't answer a credential prompt, so use public
HTTPS or browser-transparent SSO.

1. **Host the folder** on any static HTTPS host — S3 + CloudFront, Netlify, an
   internal Nginx, or **GitHub Pages** (free; this repo could serve at
   `https://noodyyeung.github.io/TableauDecisonMap/index.html`). Upload the whole
   project as-is (`index.html`, `js/`, `css/`, `lib/`, `configure.html`).
2. **Point the manifest at it:** edit `decision-map.trex` →
   `<source-location><url>https://your-host/index.html</url></source-location>`.
   The Configure dialog URL is derived from `window.location.origin`, so it
   follows automatically.
3. **Safe-list the URL (site admin)** under **Settings → Extensions**:
   - Turn on **"Let users run extensions on this site."**
   - Under **"Enable Specific Extensions,"** add the full URL
     `https://your-host/index.html` to the safe list.
   - This extension requests **full data**, so set **"Allow Full Data" = Yes** for
     that entry (and choose whether to prompt the user).
4. **Use it:** add it to a dashboard (Objects → Extension → *Access Local
   Extensions* → pick the updated `.trex`). When you publish the workbook, the
   manifest is embedded and the extension loads from your HTTPS URL for every
   viewer.

Keep `localhost` in the repo's `.trex`; change the URL only in the deployed copy.

## Next steps / ideas

- Click a node to filter the dashboard: `worksheet.applyFilterAsync(field, [value], FilterUpdateType.Replace)`.
- Color nodes by stage depth, or size them by count.
- Reads via `getSummaryDataReaderAsync` (Tableau 2022.4+ / API ≥ 1.10); for older
  Tableau swap to `getSummaryDataAsync`.
