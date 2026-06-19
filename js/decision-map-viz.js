/* decision-map-viz.js — Viz (worksheet) Extension glue.
 * Reads the Stages + Size encoding shelves, builds the counted tree, manages the
 * per-(stage,value) color panel, and renders (reusing build-tree/render-tree).
 */
(function () {
  'use strict';

  const STAGES_ENCODING = 'stages';
  const SIZE_ENCODING = 'size';
  const el = (id) => document.getElementById(id);
  const settings = () => tableau.extensions.settings;

  // ---- per-(stage,value) color persistence -------------------------------
  const colorKey = (stage, value) => `clr_${stage}_${value}`;
  const getColor = (stage, value) => settings().get(colorKey(stage, value)) || DecisionMap.autoColor(stage, value);
  function setColor(stage, value, hex) { settings().set(colorKey(stage, value), hex); settings().saveAsync(); }

  tableau.extensions.initializeAsync().then(() => {
    const worksheet = tableau.extensions.worksheetContent.worksheet;
    let lastTree = null, lastStages = [], lastSizeName = null;

    // Click a node -> select its path's marks so native filter actions fire.
    function onNodeClick(path) {
      const criteria = [];
      path.forEach((value, i) => {
        if (value !== '(none)' && lastStages[i]) criteria.push({ fieldName: lastStages[i], value: [value] });
      });
      const update = criteria.length
        ? worksheet.selectMarksByValueAsync(criteria, tableau.SelectionUpdateType.Replace)
        : worksheet.clearSelectedMarksAsync();
      Promise.resolve(update).catch((e) => console.warn('select failed:', e));
    }

    function draw() {
      DecisionMap.renderTree(lastTree, el('tree'),
        { onNodeClick, color: getColor, sizeName: lastSizeName, showPercent: true });
    }

    async function updateAndRender() {
      const { stages, sizeField } = await getEncodings(worksheet);
      lastStages = stages; lastSizeName = sizeField;
      if (stages.length === 0) { showHint(true); el('colorBtn').classList.add('hidden'); return; }
      const rows = await getRows(worksheet, sizeField);
      showHint(false); el('colorBtn').classList.remove('hidden');
      lastTree = DecisionMap.build(rows, stages, { sizeField });
      DecisionMap.buildColorPanel(el('swatches'), collectPairs(lastTree), getColor, setColor, draw);
      draw();
    }

    el('colorBtn').addEventListener('click', () => el('colorPanel').classList.toggle('hidden'));
    el('colorClose').addEventListener('click', () => el('colorPanel').classList.add('hidden'));
    window.addEventListener('resize', () => { if (lastTree) draw(); });
    worksheet.addEventListener(tableau.TableauEventType.SummaryDataChanged, updateAndRender);
    updateAndRender();
  }).catch((e) => { el('hint').textContent = 'Init failed: ' + e; showHint(true); });

  // ---- encodings: ordered stage fields + optional size measure -----------
  async function getEncodings(worksheet) {
    const spec = await worksheet.getVisualSpecificationAsync();
    const stages = []; let sizeField = null;
    if (spec.activeMarksSpecificationIndex >= 0) {
      const marks = spec.marksSpecifications[spec.activeMarksSpecificationIndex];
      marks.encodings.forEach((enc) => {
        if (enc.id === STAGES_ENCODING) stages.push(enc.field.name);
        else if (enc.id === SIZE_ENCODING) sizeField = enc.field.name;
      });
    }
    return { stages, sizeField };
  }

  // Summary data -> rows. Size column kept numeric; stage columns formatted.
  async function getRows(worksheet, sizeField) {
    const reader = await worksheet.getSummaryDataReaderAsync(undefined, { ignoreSelection: true });
    const rows = [];
    for (let p = 0; p < reader.pageCount; p++) {
      const page = await reader.getPageAsync(p);
      page.data.forEach((r) => {
        const o = {};
        page.columns.forEach((c) => {
          const dv = r[c.index];
          if (c.fieldName === sizeField) o[c.fieldName] = (dv && dv.value != null) ? Number(dv.value) : 0;
          else o[c.fieldName] = (!dv || dv.value == null) ? null : dv.formattedValue;
        });
        rows.push(o);
      });
    }
    await reader.releaseAsync();
    return rows;
  }

  // Distinct (stage=depth, value) nodes for the color panel.
  function collectPairs(tree) {
    const pairs = [], seen = new Set();
    (function walk(n, depth) {
      if (n.name && n.name !== '(none)') {
        const k = depth + '|' + n.name;
        if (!seen.has(k)) { seen.add(k); pairs.push({ stage: depth, value: n.name }); }
      }
      n.children.forEach((c) => walk(c, depth + 1));
    })(tree, 0);
    return pairs;
  }

  function showHint(yes) {
    el('hint').classList.toggle('hidden', !yes);
    el('tree').classList.toggle('hidden', yes);
  }
})();
