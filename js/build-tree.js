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

  // One row -> the ordered list of stage values it visits.
  // Blank stages are always dropped, so gaps collapse (skip-staging) and no
  // placeholder node is ever produced.
  function rowToPath(row, stageFields) {
    return stageFields
      .map((f) => (isBlank(row[f]) ? null : String(row[f]).trim()))
      .filter((v) => v !== null);
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

  function build(rows, stageFields) {
    return pathsToTree(rowsToPaths(rows, stageFields));
  }

  const api = { rowToPath, rowsToPaths, pathsToTree, build, isBlank };
  global.DecisionMap = global.DecisionMap || {};
  Object.assign(global.DecisionMap, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
