/* Logic test (node sample-data/test-logic.js) against the REAL builder + real CSV. */
const fs = require('fs');
const path = require('path');
const { build } = require('../js/build-tree.js');

const STAGES = ['i_state', '1_state', '2_state', '3_state'];

// parse the wide sample CSV
const csv = fs.readFileSync(path.join(__dirname, 'stage-data.csv'), 'utf8').trim();
const [head, ...lines] = csv.split('\n');
const cols = head.split(',');
const rows = lines.map((l) => {
  const v = l.split(',');
  return Object.fromEntries(cols.map((c, i) => [c, v[i]]));
});

function draw(node, depth = 0) {
  const edge = depth > 0 ? `  (×${node.count})` : '';
  let out = `${'  '.repeat(depth)}${node.name || '(root)'}${edge}\n`;
  node.children.forEach((c) => (out += draw(c, depth + 1)));
  return out;
}

console.log(`Parsed ${rows.length} horses. Stage columns: ${STAGES.join(' → ')}\n`);
console.log('Decision tree (blank stages collapse, no placeholder node):');
console.log(draw(build(rows, STAGES)));
