// Turns the launcher's own timing log into a CSV (kind = step, ms), account ids masked: past real runs of the
// sign-in, startup and update steps. Usage: node docs/perf/scripts/log-history.cjs > docs/perf/<date>-log-history.csv
const fs = require('node:fs');
const path = require('node:path');
const log = fs.readFileSync(path.join(process.env.APPDATA, 'claude-launcher', 'sign-in-timings.log'), 'utf8');
console.log('at,kind,ms');
for (const line of log.split(/\r?\n/)) {
  const m = /^(\S+)\s+((?:start|finish|startup|update): .*?)(\d+) ms/.exec(line);
  if (!m) continue;
  const kind = m[2].replace(/(close|open) \S+ /, '$1 <account> ').replace(/[,:(]\s*$/, '').replace(/ \d+ bytes,?/, '')
    .replace(/"/g, '').replace(/,/g, ';').trim();
  console.log(`${m[1]},"${kind}",${m[3]}`);
}
