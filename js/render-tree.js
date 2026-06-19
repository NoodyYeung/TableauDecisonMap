/* render-tree.js — pure D3 rendering. Knows nothing about Tableau.
 * Input: a counted tree { name, count, sizeSum, children:[...] } (build-tree.js).
 * Nodes are sharp-cornered RECTANGLES with the value centered inside.
 *   - fill        = opts.color(stage, value) (per-(stage,value)); default blue/green
 *   - box area    = grows with sqrt(sizeSum) (text box is the floor)
 *   - edge label  = count, plus "(n%)" of parent when opts.showPercent
 *   - edge weight = thickness scaled by count
 */
(function (global) {
  'use strict';

  function renderTree(treeRoot, svgEl, opts) {
    opts = opts || {};
    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();
    if (!treeRoot || !treeRoot.children || treeRoot.children.length === 0) return false;

    const root = d3.hierarchy(treeRoot);
    const isSynthetic = (d) => d.depth === 0 && !d.data.name;

    // Size -> per-node scale (area grows with sqrt(size); the text box is the floor).
    const hasSize = !!opts.sizeName;
    const maxSize = d3.max(root.descendants(), (d) => d.data.sizeSum || 0) || 0;
    const scaleOf = (d) => (hasSize && maxSize > 0
      ? 1 + Math.sqrt((d.data.sizeSum || 0) / maxSize) * 1.5 : 1); // [1, 2.5]

    const FONT = 12, LINE = FONT + 4, PADX = 9, PADY = 5;
    const boxH = (d) => (LINE + PADY * 2) * scaleOf(d);

    // Layout: vertical gap derives from the tallest box so scaled boxes don't collide.
    const maxBoxH = d3.max(root.descendants(), boxH) || 22;
    const dy = 220;
    d3.tree().nodeSize([Math.max(30, maxBoxH + 14), dy])(root);
    let minX = Infinity, maxX = -Infinity;
    root.each((d) => { minX = Math.min(minX, d.x); maxX = Math.max(maxX, d.x); });
    const width = (root.height + 1) * dy + 320;
    const height = Math.max((maxX - minX) + maxBoxH + 60, 200);
    svg.attr('viewBox', [0, 0, width, height]).attr('width', width).attr('height', height);
    const g = svg.append('g').attr('transform', `translate(130, ${-minX + maxBoxH / 2 + 24})`);

    const maxCount = d3.max(root.descendants(), (d) => d.data.count) || 1;
    const weight = d3.scaleSqrt().domain([1, Math.max(2, maxCount)]).range([1.5, 14]);
    const colorOf = (d) => {
      const c = (typeof opts.color === 'function') ? opts.color(d.depth, d.data.name) : null;
      return c || (d.children ? '#4e79a7' : '#59a14f');
    };
    const contrast = (hex) => {
      const m = /^#?([0-9a-fA-F]{6})$/.exec(hex || '');
      if (!m) return '#111';
      const n = parseInt(m[1], 16);
      const lum = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
      return lum > 150 ? '#111' : '#fff';
    };
    const pctOf = (d) => (d.parent && d.parent.data.count ? Math.round((d.data.count / d.parent.data.count) * 100) : null);
    const tip = (d) => {
      const p = pctOf(d);
      let t = `${d.data.name} · ${d.data.count} horse(s)`;
      if (p !== null) t += ` (${p}% of parent)`;
      if (hasSize) t += `\n${opts.sizeName}: ${(d.data.sizeSum || 0).toLocaleString()}`;
      return t;
    };

    const linkG = g.append('g');   // z-order: links < nodes < edge labels
    const nodeG = g.append('g');
    const labelG = g.append('g');

    // Nodes: rectangles + centered value text (skip synthetic root & invisible (none)).
    const node = nodeG.selectAll('g')
      .data(root.descendants().filter((d) => !isSynthetic(d) && d.data.name !== '(none)'))
      .join('g')
      .attr('class', (d) => 'node' + (d.children ? '' : ' leaf'))
      .attr('transform', (d) => `translate(${d.y},${d.x})`);

    if (typeof opts.onNodeClick === 'function') {
      node.style('cursor', 'pointer').on('click', (event, d) => {
        const path = d.ancestors().reverse().filter((a) => !isSynthetic(a)).map((a) => a.data.name);
        opts.onNodeClick(path, event);
      });
    }

    node.append('title').text(tip);
    const text = node.append('text')
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
      .style('font-size', FONT + 'px')
      .text((d) => d.data.name);

    // Measure each label, size its box, store half-width for edge routing.
    node.each(function (d) {
      const tw = this.querySelector('text').getComputedTextLength();
      d._w = Math.max((tw + PADX * 2) * scaleOf(d), 18);
      d._h = boxH(d);
    });
    node.insert('rect', 'text')
      .attr('class', 'node-rect')
      .attr('x', (d) => -d._w / 2).attr('y', (d) => -d._h / 2)
      .attr('width', (d) => d._w).attr('height', (d) => d._h)
      .attr('fill', (d) => colorOf(d));
    text.attr('fill', (d) => contrast(colorOf(d)));

    // Links: parent right edge -> child left edge (route through invisible nodes' centers).
    const hw = (n) => (n._w ? n._w / 2 : 0);
    linkG.selectAll('path').data(root.links()).join('path')
      .attr('class', 'link')
      .attr('stroke-width', (d) => weight(d.target.data.count))
      .attr('d', (d) => {
        const sx = d.source.y + hw(d.source), sy = d.source.x;
        const tx = d.target.y - hw(d.target), ty = d.target.x;
        const mx = (sx + tx) / 2;
        return `M${sx},${sy}C${mx},${sy} ${mx},${ty} ${tx},${ty}`;
      });

    // Edge labels: count (%) at the midpoint of node centers.
    labelG.selectAll('text')
      .data(root.links().filter((d) => d.target.data.name !== '(none)'))
      .join('text')
      .attr('class', 'link-label')
      .attr('x', (d) => (d.source.y + d.target.y) / 2)
      .attr('y', (d) => (d.source.x + d.target.x) / 2)
      .attr('dy', '-0.35em').attr('text-anchor', 'middle')
      .text((d) => {
        const c = d.target.data.count;
        const p = opts.showPercent ? pctOf(d.target) : null;
        return p === null ? String(c) : `${c} (${p}%)`;
      });

    return true;
  }

  global.DecisionMap = global.DecisionMap || {};
  global.DecisionMap.renderTree = renderTree;
  if (typeof module !== 'undefined' && module.exports) module.exports = { renderTree };
})(typeof window !== 'undefined' ? window : globalThis);
