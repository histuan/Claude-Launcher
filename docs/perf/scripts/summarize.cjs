// Median / p90 / min / max of each numeric column of a perf CSV, grouped by the "kind" column when it exists.
// Usage: node docs/perf/scripts/summarize.cjs docs/perf/<file>.csv
const fs = require('fs');
const [head, ...lines] = fs.readFileSync(process.argv[2], 'utf8').replace(/^﻿/, '').trim().split(/\r?\n/);
const cols = head.split(',').map((c) => c.replace(/"/g, ''));
const rows = lines.map((l) => Object.fromEntries(l.split(',').map((v, i) => [cols[i], v.replace(/"/g, '')])));
const q = (s, p) => s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)];
const groups = {};
for (const r of rows) (groups[r.kind || 'all'] ||= []).push(r);
for (const [kind, rs] of Object.entries(groups)) {
  console.log(`${kind} (n=${rs.length})`);
  for (const c of cols) {
    if (c === 'run' || c === 'kind') continue;
    const v = rs.map((r) => r[c]).filter((x) => x !== '' && !isNaN(x)).map(Number).sort((a, b) => a - b);
    if (v.length) console.log(`  ${c}: median ${q(v, 0.5)}, p90 ${q(v, 0.9)}, min ${v[0]}, max ${v[v.length - 1]} (n=${v.length})`);
  }
}
