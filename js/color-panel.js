/* color-panel.js — the per-(stage,value) color editor + default palette.
 * Pure DOM + a deterministic default palette; persistence is injected.
 */
(function (global) {
  'use strict';

  const PALETTE = ['#4e79a7', '#59a14f', '#f28e2b', '#e15759', '#76b7b2',
    '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac'];

  function hashStr(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  // Deterministic default color for a (stage, value) node.
  function autoColor(stage, value) {
    return PALETTE[hashStr(stage + '|' + value) % PALETTE.length];
  }

  const toHex = (c) => (/^#[0-9a-fA-F]{6}$/.test(c || '') ? c : '#888888');

  // Fill `container` with a swatch row per (stage,value) pair.
  // getColor(stage,value)->hex, setColor(stage,value,hex), onChange() re-renders.
  function buildColorPanel(container, pairs, getColor, setColor, onChange) {
    container.innerHTML = '';
    pairs.slice()
      .sort((a, b) => a.stage - b.stage || String(a.value).localeCompare(String(b.value)))
      .forEach((p) => {
        const row = document.createElement('label');
        row.className = 'swatch-row';
        const inp = document.createElement('input');
        inp.type = 'color';
        inp.value = toHex(getColor(p.stage, p.value));
        inp.addEventListener('input', () => { setColor(p.stage, p.value, inp.value); onChange(); });
        const txt = document.createElement('span');
        txt.className = 'swatch-label';
        txt.textContent = `S${p.stage}  ${p.value}`;
        row.appendChild(inp);
        row.appendChild(txt);
        container.appendChild(row);
      });
    if (pairs.length === 0) container.textContent = 'No nodes yet.';
  }

  global.DecisionMap = global.DecisionMap || {};
  global.DecisionMap.autoColor = autoColor;
  global.DecisionMap.buildColorPanel = buildColorPanel;
})(typeof window !== 'undefined' ? window : globalThis);
