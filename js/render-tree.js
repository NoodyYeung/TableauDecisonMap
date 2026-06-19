/* render-tree.js — pure D3 rendering. Knows nothing about Tableau.
 * Input: a counted tree { name, count, children:[...] } (from build-tree.js).
 * Draws a left-to-right tree where:
 *   - node label  = stage value (name)
 *   - edge label  = horse count reaching that node
 *   - edge weight = thickness scaled by that count
 */
(function (global) {
  'use strict';

  function renderTree(treeRoot, svgEl) {
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
      .text((d) => d.target.data.count);

    // Nodes — skip the synthetic root connector AND the invisible (none)
    // placeholders (kept in the layout for stage alignment, never drawn).
    const node = g.append('g').selectAll('g')
      .data(root.descendants().filter((d) => !isSynthetic(d) && d.data.name !== '(none)'))
      .join('g')
      .attr('class', (d) => 'node' + (d.children ? '' : ' leaf'))
      .attr('transform', (d) => `translate(${d.y},${d.x})`);

    node.append('circle').attr('r', 6)
      .append('title').text((d) => `${d.data.name} · ${d.data.count} horse(s)`);

    const text = node.append('text').text((d) => d.data.name);
    // Root label sits ABOVE its node so it always renders (never clipped at the left edge).
    text.filter((d) => d.depth === 0).attr('text-anchor', 'middle').attr('x', 0).attr('y', -13);
    text.filter((d) => d.depth !== 0)
      .attr('dy', '0.32em')
      .attr('x', (d) => (d.children ? -11 : 11))
      .attr('text-anchor', (d) => (d.children ? 'end' : 'start'));

    return true;
  }

  global.DecisionMap = global.DecisionMap || {};
  global.DecisionMap.renderTree = renderTree;
  if (typeof module !== 'undefined' && module.exports) module.exports = { renderTree };
})(typeof window !== 'undefined' ? window : globalThis);
