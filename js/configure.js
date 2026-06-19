/* configure.js — runs inside the gear-menu dialog.
 * Pick the source worksheet and the ordered stage columns, then persist.
 */
(function () {
  'use strict';

  const KEYS = { ws: 'worksheet', stages: 'stageColumns' };
  const STAGE_RE = /^([0-9]+|i)_state$/i;
  const rank = (n) => { const m = STAGE_RE.exec(n); return !m ? 999 : (m[1].toLowerCase() === 'i' ? -1 : parseInt(m[1], 10)); };
  const el = (id) => document.getElementById(id);

  tableau.extensions.initializeDialogAsync().then(() => {
    const dash = tableau.extensions.dashboardContent.dashboard;
    const s = tableau.extensions.settings;

    const wsSel = el('cfgWorksheet');
    dash.worksheets.forEach((w) => wsSel.add(new Option(w.name, w.name)));
    wsSel.value = s.get(KEYS.ws) || (dash.worksheets[0] && dash.worksheets[0].name) || '';
    if (s.get(KEYS.stages)) el('cfgStages').value = s.get(KEYS.stages);

    wsSel.addEventListener('change', () => suggestStages(dash, s));
    suggestStages(dash, s);

    el('cfgCancel').addEventListener('click', () => tableau.extensions.ui.closeDialog(''));
    el('cfgSave').addEventListener('click', () => {
      s.set(KEYS.ws, wsSel.value);
      s.set(KEYS.stages, el('cfgStages').value.trim());
      s.saveAsync().then(() => tableau.extensions.ui.closeDialog('saved'));
    });
  }).catch((e) => document.body.insertAdjacentHTML('beforeend', '<p>Dialog error: ' + e + '</p>'));

  // Read one page of the chosen worksheet to discover columns; auto-fill stage order.
  async function suggestStages(dash, s) {
    const ws = dash.worksheets.find((w) => w.name === el('cfgWorksheet').value);
    if (!ws) return;
    const reader = await ws.getSummaryDataReaderAsync(undefined, { ignoreSelection: true });
    const page = reader.pageCount ? await reader.getPageAsync(0) : { columns: [] };
    await reader.releaseAsync();
    const names = page.columns.map((c) => c.fieldName);

    el('cfgAvail').textContent = 'Available: ' + (names.join(', ') || '(none)');
    if (!el('cfgStages').value.trim() && !s.get(KEYS.stages)) {
      el('cfgStages').value = names.filter((n) => STAGE_RE.test(n)).sort((a, b) => rank(a) - rank(b)).join(', ');
    }
  }
})();
