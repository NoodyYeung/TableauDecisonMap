/* render-tree.js — pure D3 rendering. Knows nothing about Tableau.
 * Input: a counted tree { name, count, children:[...] } (from build-tree.js).
 * Draws a left-to-right tree where:
 *   - node label  = stage value (name)
 *   - edge label  = horse count reaching that node
 *   - edge weight = thickness scaled by that count
 */
(function (global) {
  'use strict';

  // opts.onNodeClick(pathNames) — called with the stage values from root to the
  // clicked node (index i aligns with stage i, '(none)' for skipped stages).
  function renderTree(treeRoot, svgEl, opts) {
    opts = opts || {};
    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();
    if (!treeRoot || !treeRoot.children || treeRoot.children.length === 0) return false;

    const root = d3.hierarchy(treeRoot);
    const isSynthetic = (d) => d.depth === 0 && !d.data.name;

    // Layout sizing scales with the tree so it stays readable.
    const dx = 30;                       // vertical gap between siblings
    const dy = 200;                      // horizontal gap between levels
    const width = (root.height + 1) * dy + 240;
    const height = Math.max(root.leaves().length * dx + 40, 200);
    svg.attr('viewBox', [0, 0, width, height]).attr('width', width).attr('height', height);

    d3.tree().nodeSize([dx, dy])(root);
    let minX = Infinity;
    root.each((d) => { minX = Math.min(minX, d.x); });
    const g = svg.append('g').attr('transform', `translate(90, ${-minX + 24})`);

    // Thickness scale: edge weight grows with horse count (sqrt = better area perception).
    const maxCount = d3.max(root.descendants(), (d) => d.data.count) || 1;
    const weight = d3.scaleSqrt().domain([1, Math.max(2, maxCount)]).range([1.5, 14]);

    // Node radius: by the Size measure (sqrt = area-proportional) when provided, else fixed.
    const hasSize = !!opts.sizeName;
    const maxSize = d3.max(root.descendants(), (d) => d.data.sizeSum || 0) || 0;
    const sizeScale = d3.scaleSqrt().domain([0, Math.max(1, maxSize)]).range([4, 22]);
    const radiusOf = (d) => (hasSize && maxSize > 0 ? sizeScale(d.data.sizeSum || 0) : 6);
    // Per-node color by (stage, value); returns null to fall back to CSS defaults.
    const colorOf = (d) => (typeof opts.color === 'function' ? opts.color(d.depth, d.data.name) : null);
    const pctOfParent = (d) => (d.parent && d.parent.data.count ? Math.round((d.data.count / d.parent.data.count) * 100) : null);

    // Links
    g.append('g').selectAll('path')
      .data(root.links())
      .join('path')
      .attr('class', 'link')
      .attr('stroke-width', (d) => weight(d.target.data.count))
      .attr('d', d3.linkHorizontal().x((d) => d.y).y((d) => d.x));

    // Edge labels = the count of horses on that edge (skip edges into invisible (none)).
    g.append('g').selectAll('text.link-label')
      .data(root.links().filter((d) => d.target.data.name !== '(none)'))
      .join('text')
      .attr('class', 'link-label')
      .attr('x', (d) => (d.source.y + d.target.y) / 2)
      .attr('y', (d) => (d.source.x + d.target.x) / 2)
      .attr('dy', '-0.35em')
      .attr('text-anchor', 'middle')
      .text((d) => {
        const c = d.target.data.count;
        const pct = opts.showPercent ? pctOfParent(d.target) : null;
        return pct === null ? String(c) : `${c} (${pct}%)`;
      });

    // Nodes — skip the synthetic root connector AND the invisible (none)
    // placeholders (kept in the layout for stage alignment, never drawn).
    const node = g.append('g').selectAll('g')
      .data(root.descendants().filter((d) => !isSynthetic(d) && d.data.name !== '(none)'))
      .join('g')
      .attr('class', (d) => 'node' + (d.children ? '' : ' leaf'))
      .attr('transform', (d) => `translate(${d.y},${d.x})`);

    // Optional click-to-select: pass the path (root -> node) of stage values.
    if (typeof opts.onNodeClick === 'function') {
      node.style('cursor', 'pointer').on('click', (event, d) => {
        const path = d.ancestors().reverse()
          .filter((a) => !isSynthetic(a))
          .map((a) => a.data.name);
        opts.onNodeClick(path, event);
      });
    }

    node.append('circle')
      .attr('r', radiusOf)
      .attr('fill', (d) => colorOf(d))            // null -> CSS default (leaf/internal)
      .append('title').text((d) => {
        const pct = pctOfParent(d);
        let t = `${d.data.name} · ${d.data.count} horse(s)`;
        if (pct !== null) t += ` (${pct}% of parent)`;
        if (hasSize) t += `\n${opts.sizeName}: ${(d.data.sizeSum || 0).toLocaleString()}`;
        return t;
      });

    const text = node.append('text').text((d) => d.data.name);
    // Root label sits ABOVE its node so it always renders (never clipped at the left edge).
    text.filter((d) => d.depth === 0).attr('text-anchor', 'middle').attr('x', 0).attr('y', (d) => -(radiusOf(d) + 7));
    text.filter((d) => d.depth !== 0)
      .attr('dy', '0.32em')
      .attr('x', (d) => (d.children ? -(radiusOf(d) + 5) : radiusOf(d) + 5))
      .attr('text-anchor', (d) => (d.children ? 'end' : 'start'));

    return true;
  }

  global.DecisionMap = global.DecisionMap || {};
  global.DecisionMap.renderTree = renderTree;
  if (typeof module !== 'undefined' && module.exports) module.exports = { renderTree };
})(typeof window !== 'undefined' ? window : globalThis);
