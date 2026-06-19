# Decision Map — Tableau Dashboard Extension

A dashboard extension that reads a worksheet of **staged state columns**
(`i_state → 1_state → 2_state → 3_state`) and draws a left-to-right
**decision tree**. Each row (e.g. a horse) is one path through the stages;
identical sub-paths are merged and counted.

- **Node** = a stage value (`retired`, `a`, `b`, …).
- **Edge label** = how many rows took that branch.
- **Edge thickness** = scales with that count.
- **Empty stage cell** = no node at all. Blanks are always dropped and gaps
  collapse (*staging skipping*) — e.g. a row with a blank stage 1 but a filled
  stage 2 is drawn `i_state → 2_state` directly. No placeholder node is created.
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
| `index.html` | Extension UI (toolbar + SVG canvas). |
| `preview.html` | **Standalone** preview with inline sample data — renders the tree with no Tableau. Open it in a browser to iterate the visual. |
| `js/build-tree.js` | Pure data shaping: wide rows → paths → counted prefix tree. |
| `js/render-tree.js` | Pure D3 renderer (counted tree → SVG). |
| `js/decision-map.js` | Tableau glue: read worksheet, resolve stage columns, build + render. |
| `configure.html` / `js/configure.js` | Gear-menu dialog (pick worksheet + stage columns). |
| `lib/` | Vendored Extensions API + D3 (no CDN dependency). |
| `sample-data/stage-data.csv` | Demo data matching the table above. |
| `sample-data/test-logic.js` | `node sample-data/test-logic.js` — tests the builder against the CSV. |

## Run it (Tableau Desktop)

1. **Serve the folder** (the manifest URL must resolve):
   ```bash
   cd ~/Projects/TablueExt
   npx http-server -p 8080 -c-1 .     # or: python3 -m http.server 8080
   ```
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

## Deploying to Tableau Cloud / Server

Host this folder over **HTTPS** (S3 + CloudFront, Netlify, …), change the `<url>`
in `decision-map.trex` to the public `https://…/index.html`, and have an admin
allow-list the domain (Settings → Extensions).

## Next steps / ideas

- Click a node to filter the dashboard: `worksheet.applyFilterAsync(field, [value], FilterUpdateType.Replace)`.
- Color nodes by stage depth, or size them by count.
- Reads via `getSummaryDataReaderAsync` (Tableau 2022.4+ / API ≥ 1.10); for older
  Tableau swap to `getSummaryDataAsync`.
