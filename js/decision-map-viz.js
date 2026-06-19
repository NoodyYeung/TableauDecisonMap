/* decision-map-viz.js — Viz (worksheet) Extension glue.
 * Reads the fields the user dropped on the Initial/Stage encoding shelves,
 * builds the ordered stage list, then reuses build-tree.js + render-tree.js.
 */
(function () {
  'use strict';

  // Encoding ids from decision-map-viz.trex, IN STAGE ORDER (max 4 per Tableau).
  const STAGE_ENCODINGS = ['istate', 'stage1', 'stage2', 'stage3'];
  const el = (id) => document.getElementById(id);

  tableau.extensions.initializeAsync().then(() => {
    const worksheet = tableau.extensions.worksheetContent.worksheet;
    let lastTree = null;

    async function updateAndRender() {
      const [rows, stageFields] = await Promise.all([
        getRows(worksheet),
        getStageFields(worksheet),
      ]);
      if (stageFields.length === 0) { showHint(true); return; }
      showHint(false);
      lastTree = DecisionMap.build(rows, stageFields);
      DecisionMap.renderTree(lastTree, el('tree'));
    }

    // Re-render (no refetch) on resize; refetch when the data changes.
    window.addEventListener('resize', () => { if (lastTree) DecisionMap.renderTree(lastTree, el('tree')); });
    worksheet.addEventListener(tableau.TableauEventType.SummaryDataChanged, updateAndRender);
    updateAndRender();
  }).catch((e) => { el('hint').textContent = 'Init failed: ' + e; showHint(true); });

  // encoding id -> field the user placed on that shelf -> ordered stage field names.
  async function getStageFields(worksheet) {
    const spec = await worksheet.getVisualSpecificationAsync();
    const map = {};
    if (spec.activeMarksSpecificationIndex >= 0) {
      const marks = spec.marksSpecifications[spec.activeMarksSpecificationIndex];
      marks.encodings.forEach((enc) => { map[enc.id] = enc.field; });
    }
    return STAGE_ENCODINGS
      .filter((id) => map[id])
      .map((id) => map[id].name);
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
