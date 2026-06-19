/* decision-map.js — Tableau Extensions glue.
 * Reads a worksheet's ordered stage columns (i_state, 1_state, 2_state, …),
 * builds a counted prefix tree (build-tree.js), and renders it (render-tree.js).
 */
(function () {
  'use strict';

  const KEYS = { ws: 'worksheet', stages: 'stageColumns' };
  const el = (id) => document.getElementById(id);
  const settings = () => tableau.extensions.settings;
  const setStatus = (msg) => { el('status').textContent = msg || ''; };

  // i_state ranks first, then numbered stages ascending.
  const STAGE_RE = /^([0-9]+|i)_state$/i;
  const stageRank = (name) => {
    const m = STAGE_RE.exec(name);
    if (!m) return 999;
    return m[1].toLowerCase() === 'i' ? -1 : parseInt(m[1], 10);
  };

  // ---- init ---------------------------------------------------------------
  tableau.extensions.initializeAsync({ configure }).then(() => {
    const dash = tableau.extensions.dashboardContent.dashboard;
    populateWorksheets(dash);
    wireEvents();
    loadAndRender();
  }).catch((e) => setStatus('Init failed: ' + e));

  // ---- worksheet picker ---------------------------------------------------
  function populateWorksheets(dash) {
    const sel = el('worksheetSelect');
    sel.innerHTML = '';
    dash.worksheets.forEach((w) => sel.add(new Option(w.name, w.name)));
    const saved = settings().get(KEYS.ws);
    if (saved && dash.worksheets.some((w) => w.name === saved)) sel.value = saved;
  }

  function currentWorksheet() {
    const dash = tableau.extensions.dashboardContent.dashboard;
    return dash.worksheets.find((w) => w.name === el('worksheetSelect').value);
  }

  // ---- events -------------------------------------------------------------
  let unregister = [];
  function wireEvents() {
    el('refreshBtn').addEventListener('click', loadAndRender);
    el('worksheetSelect').addEventListener('change', () => {
      settings().set(KEYS.ws, el('worksheetSelect').value);
      settings().saveAsync().then(loadAndRender);
    });
  }

  function listen(ws) {
    unregister.forEach((u) => u());
    unregister = [];
    if (!ws) return;
    [tableau.TableauEventType.FilterChanged, tableau.TableauEventType.SummaryDataChanged]
      .forEach((evt) => unregister.push(ws.addEventListener(evt, loadAndRender)));
  }

  // ---- data load + render -------------------------------------------------
  function loadAndRender() {
    const ws = currentWorksheet();
    if (!ws) { showEmpty(true); setStatus('No worksheet'); return; }
    listen(ws);
    setStatus('Loading…');
    readSummary(ws).then(({ columns, dataRows }) => {
      const stages = resolveStages(columns);
      if (stages.length === 0) { showEmpty(true); setStatus('No *_state columns — use Configure'); return; }
      const rows = toRows(columns, dataRows);
      const tree = DecisionMap.build(rows, stages);
      showEmpty(!DecisionMap.renderTree(tree, el('tree')));
      setStatus(`${rows.length} rows · ${stages.join(' → ')}`);
    }).catch((e) => { showEmpty(true); setStatus('Error: ' + e); });
  }

  // Paginated read via the modern DataTableReader (Tableau 2022.4+ / API 1.10).
  async function readSummary(ws) {
    const reader = await ws.getSummaryDataReaderAsync(undefined, { ignoreSelection: true });
    let columns = [];
    const dataRows = [];
    for (let p = 0; p < reader.pageCount; p++) {
      const page = await reader.getPageAsync(p);
      columns = page.columns;
      page.data.forEach((r) => dataRows.push(r));
    }
    await reader.releaseAsync();
    return { columns, dataRows };
  }

  // Which columns are the ordered stages? Saved setting wins; else auto-detect.
  function resolveStages(columns) {
    const names = columns.map((c) => c.fieldName);
    const saved = settings().get(KEYS.stages);
    const order = saved
      ? saved.split(',').map((s) => s.trim()).filter(Boolean)
      : names.filter((n) => STAGE_RE.test(n)).sort((a, b) => stageRank(a) - stageRank(b));
    return order.filter((n) => names.includes(n));
  }

  // DataTable rows -> plain {fieldName: value|null} objects.
  function toRows(columns, dataRows) {
    return dataRows.map((r) => {
      const o = {};
      columns.forEach((c) => {
        const dv = r[c.index];
        o[c.fieldName] = (!dv || dv.value === null || dv.value === undefined) ? null : dv.formattedValue;
      });
      return o;
    });
  }

  function showEmpty(yes) {
    el('empty').classList.toggle('hidden', !yes);
    el('tree').classList.toggle('hidden', yes);
  }

  // ---- gear-menu Configure ------------------------------------------------
  function configure() {
    const url = window.location.origin + '/configure.html';
    tableau.extensions.ui.displayDialogAsync(url, '', { height: 360, width: 420 })
      .then(loadAndRender)
      .catch((e) => { if (e.errorCode !== tableau.ErrorCodes.DialogClosedByUser) setStatus('Config: ' + e); });
  }
})();
