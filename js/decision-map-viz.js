/* decision-map-viz.js — Viz (worksheet) Extension glue.
 * Reads the fields the user dropped on the Initial/Stage encoding shelves,
 * builds the ordered stage list, then reuses build-tree.js + render-tree.js.
 */
(function () {
  'use strict';

  // The single multi-field encoding id from decision-map-viz.trex.
  const STAGES_ENCODING = 'stages';
  const el = (id) => document.getElementById(id);

  tableau.extensions.initializeAsync().then(() => {
    const worksheet = tableau.extensions.worksheetContent.worksheet;
    let lastTree = null;
    let lastStages = [];

    // Click a node -> select the marks on its path so native Tableau filter
    // actions (run "On Select") fire. Path index i aligns with stage field i.
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

    function draw() { DecisionMap.renderTree(lastTree, el('tree'), { onNodeClick }); }

    async function updateAndRender() {
      const [rows, stageFields] = await Promise.all([
        getRows(worksheet),
        getStageFields(worksheet),
      ]);
      lastStages = stageFields;
      if (stageFields.length === 0) { showHint(true); return; }
      showHint(false);
      lastTree = DecisionMap.build(rows, stageFields);
      draw();
    }

    // Re-render (no refetch) on resize; refetch when the data changes.
    window.addEventListener('resize', () => { if (lastTree) draw(); });
    worksheet.addEventListener(tableau.TableauEventType.SummaryDataChanged, updateAndRender);
    updateAndRender();
  }).catch((e) => { el('hint').textContent = 'Init failed: ' + e; showHint(true); });

  // Every field the user dropped on the "Stages" shelf, IN ORDER (dynamic count).
  // marksCard.encodings lists one entry per field; the same id repeats in drop order.
  async function getStageFields(worksheet) {
    const spec = await worksheet.getVisualSpecificationAsync();
    const fields = [];
    if (spec.activeMarksSpecificationIndex >= 0) {
      const marks = spec.marksSpecifications[spec.activeMarksSpecificationIndex];
      marks.encodings.forEach((enc) => { if (enc.id === STAGES_ENCODING) fields.push(enc.field.name); });
    }
    return fields;
  }

  // Summary data -> [{ fieldName: formattedValue|null }, ...] keyed by column name.
  async function getRows(worksheet) {
    const reader = await worksheet.getSummaryDataReaderAsync(undefined, { ignoreSelection: true });
    const rows = [];
    for (let p = 0; p < reader.pageCount; p++) {
      const page = await reader.getPageAsync(p);
      page.data.forEach((r) => {
        const o = {};
        page.columns.forEach((c) => {
          const dv = r[c.index];
          o[c.fieldName] = (!dv || dv.value === null || dv.value === undefined) ? null : dv.formattedValue;
        });
        rows.push(o);
      });
    }
    await reader.releaseAsync();
    return rows;
  }

  function showHint(yes) {
    el('hint').classList.toggle('hidden', !yes);
    el('tree').classList.toggle('hidden', yes);
  }
})();
