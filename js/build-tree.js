/* build-tree.js — pure data shaping. Knows nothing about Tableau or D3.
 * Wide staged rows -> ordered paths -> counted prefix tree (trie).
 *
 * A "row" here is a plain object of stageField -> value, e.g.
 *   { i_state: 'retired', '1_state': 'b', '2_state': 'c', '3_state': 'd' }
 */
(function (global) {
  'use strict';

  const isBlank = (v) => v === undefined || v === null ||
    (typeof v === 'string' && (v.trim() === '' || v.trim().toLowerCase() === 'null'));

  // One row -> ordered stage values, ONE ENTRY PER STAGE so tree depth == stage
  // level (columns stay aligned). A skipped (blank) stage becomes a '(none)'
  // placeholder — kept for layout but rendered invisibly. Trailing blanks (the
  // row simply ended) are dropped so early-stoppers don't grow phantom nodes.
  function rowToPath(row, stageFields) {
    const raw = stageFields.map((f) => (isBlank(row[f]) ? null : String(row[f]).trim()));
    let last = -1;
    raw.forEach((v, i) => { if (v !== null) last = i; });
    if (last < 0) return [];
    const path = [];
    for (let i = 0; i <= last; i++) path.push(raw[i] !== null ? raw[i] : '(none)');
    return path;
  }

  function rowsToPaths(rows, stageFields) {
    return rows.map((r) => rowToPath(r, stageFields)).filter((p) => p.length > 0);
  }

  // Paths -> trie. Each node: { name, count, children: [] }.
  // Identity is the full path prefix, so branches never re-merge (always a tree).
  function pathsToTree(paths) {
    const root = { name: '', count: 0, children: [], _index: new Map() };
    for (const path of paths) {
      let node = root;
      node.count += 1;
      for (const value of path) {
        let child = node._index.get(value);
        if (!child) {
          child = { name: value, count: 0, children: [], _index: new Map() };
          node._index.set(value, child);
          node.children.push(child);
        }
        child.count += 1;
        node = child;
      }
    }
    // Strip the internal index maps so the tree is clean JSON.
    (function clean(n) { delete n._index; n.children.forEach(clean); })(root);
    // If every path shares one starting value (e.g. all 'retired'), use it as the visible root.
    return root.children.length === 1 ? root.children[0] : root;
  }

  const toNum = (v) => {
    if (v === null || v === undefined || v === '') return 0;
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[, ]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };

  // Build the counted prefix tree. opts.sizeField (optional) is a numeric column
  // summed into each node's `sizeSum` (for node-size encoding).
  function build(rows, stageFields, opts) {
    const sizeField = opts && opts.sizeField;
    const root = { name: '', count: 0, sizeSum: 0, children: [], _index: new Map() };
    for (const row of rows) {
      const path = rowToPath(row, stageFields);
      if (path.length === 0) continue;
      const size = sizeField ? toNum(row[sizeField]) : 0;
      let node = root;
      node.count += 1; node.sizeSum += size;
      for (const value of path) {
        let child = node._index.get(value);
        if (!child) {
          child = { name: value, count: 0, sizeSum: 0, children: [], _index: new Map() };
          node._index.set(value, child);
          node.children.push(child);
        }
        child.count += 1; child.sizeSum += size;
        node = child;
      }
    }
    (function clean(n) { delete n._index; n.children.forEach(clean); })(root);
    return root.children.length === 1 ? root.children[0] : root;
  }

  const api = { rowToPath, rowsToPaths, pathsToTree, build, isBlank, toNum };
  global.DecisionMap = global.DecisionMap || {};
  Object.assign(global.DecisionMap, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
