// Saves names-and-shapes fixtures of the installed Claude into test/fixtures/claude-<version>/ (resilience.md guard 10).
// Never values: user paths become %LOCALAPPDATA% / %APPDATA% / %USERPROFILE%, argument values are masked, Claude Code
// CLI command lines are dropped, config.json gives key names only, the cookie columns come from a throwaway profile.
// Usage: node docs/perf/scripts/capture-fixtures.cjs   (no test-profile Claude may be running)
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const ps = (script) => execFileSync('powershell.exe', ['-NoProfile', '-Command',
  `[Console]::OutputEncoding = [Text.Encoding]::UTF8; ${script}`], { encoding: 'utf8' });
const env = (name) => process.env[name].replace(/\\$/, '');
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const masks = [['LOCALAPPDATA', env('LOCALAPPDATA')], ['APPDATA', env('APPDATA')], ['USERPROFILE', env('USERPROFILE')]];
const maskPath = (s) => masks.reduce((t, [n, v]) => t.replace(new RegExp(esc(v), 'gi'), `%${n}%`), s ?? '');
const maskIds = (s) => s.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<uuid>')
  .replace(/\b[0-9a-f]{16,}\b/gi, '<hex>').replace(/(?<=[_:])[0-9a-f]{8,}\b/gi, '<hex>');
// Allow-list: the exe, then only the --flag names; the value is kept (masked) only for --type and --user-data-dir,
// with its original quoting. Positional arguments (one is a JSON blob with the home path) are dropped.
const maskArgs = (cmd) => {
  const exe = /^("[^"]*"|\S+)/.exec(cmd)[0];
  const flags = [...cmd.slice(exe.length).matchAll(/(?:^|\s)(--[\w-]+)(=("[^"]*"|\S+))?/g)].map(([, flag, value]) =>
    (flag === '--type' || flag === '--user-data-dir') && value ? `${flag}${maskIds(maskPath(value))}` : value ? `${flag}=<value>` : flag);
  return [maskPath(exe), ...flags].join(' ');
};

const appx = JSON.parse(ps('ConvertTo-Json -Compress -InputObject @(Get-AppxPackage *Claude* | Select-Object Name, '
  + 'Version, Publisher, PublisherId, InstallLocation, PackageFamilyName, PackageFullName, Architecture, SignatureKind, IsFramework)'));
const claude = appx.find((p) => p.Name === 'Claude');
const out = path.join(__dirname, '..', '..', '..', 'test', 'fixtures', `claude-${claude.Version}`);
fs.mkdirSync(out, { recursive: true });
const save = (name, data) => fs.writeFileSync(path.join(out, name), `${JSON.stringify(data, null, 2)}\n`);
save('appx-packages.json', appx);

const manifest = fs.readFileSync(path.join(claude.InstallLocation, 'AppxManifest.xml'), 'utf8');
save('manifest-applications.json', {
  applications: [...manifest.matchAll(/<Application Id="([^"]+)" Executable="([^"]+)"/g)].map((m) => ({ Id: m[1], Executable: m[2] })),
  protocols: [...manifest.matchAll(/<uap\d*:Protocol [^>]*?Name="([^"]+)"/g)].map((m) => m[1]),
  executionAliases: [...manifest.matchAll(/ExecutionAlias Alias="([^"]+)"/g)].map((m) => m[1]),
  electron: fs.readFileSync(path.join(claude.InstallLocation, 'app', 'version'), 'utf8').trim(),
});

const procs = JSON.parse(ps(`ConvertTo-Json -Compress -InputObject @(Get-CimInstance Win32_Process -Filter "Name='claude.exe'" `
  + '| Select-Object ProcessId, ParentProcessId, ExecutablePath, CommandLine)'));
// Real process ids become 1001, 1002… (a parent outside the list becomes 1), keeping the parent links.
const pid = new Map(procs.map((p, i) => [p.ProcessId, 1001 + i]));
save('processes.json', procs.map((p) => {
  const desktop = /\\WindowsApps\\Claude_[^\\]+\\app\\Claude\.exe$/i.test(p.ExecutablePath ?? '');
  return { ProcessId: pid.get(p.ProcessId), ParentProcessId: pid.get(p.ParentProcessId) ?? 1,
    ExecutablePath: maskIds(maskPath(p.ExecutablePath)),
    CommandLine: desktop ? maskArgs(p.CommandLine) : '<Claude Code CLI or other: not kept>' };
}));

// Key names of the main profile's config.json (the launcher's cached defaultProfile), values never read.
const launcher = JSON.parse(fs.readFileSync(path.join(env('APPDATA'), 'claude-launcher', 'config.json'), 'utf8'));
const mainCfg = path.join(launcher.defaultProfile, 'config.json');
save('config-key-names.json', { profile: 'main (signed in)',
  keys: Object.keys(JSON.parse(fs.readFileSync(mainCfg, 'utf8'))).map(maskIds).sort() });

// Cookie table columns from a throwaway profile (signed out), then it is deleted.
const dir = path.join(os.tmpdir(), 'claude-launcher-fixtures');
fs.rmSync(dir, { recursive: true, force: true });
ps(`$p = Start-Process -FilePath '${path.join(claude.InstallLocation, 'app', 'Claude.exe')}' -ArgumentList '--user-data-dir="${dir}"' -PassThru; `
  + 'Start-Sleep -Seconds 15; Get-CimInstance Win32_Process -Filter "Name=\'claude.exe\'" | Where-Object { $_.CommandLine -like '
  + `'*${dir}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; Start-Sleep -Seconds 2`);
const db = new DatabaseSync(path.join(dir, 'Network', 'Cookies'), { readOnly: true });
const cols = db.prepare('PRAGMA table_info(cookies)').all().map((c) => ({ name: c.name, type: c.type }));
const meta = db.prepare("SELECT key, value FROM meta WHERE key IN ('version', 'last_compatible_version')").all();
db.close();
save('cookies-columns.json', { table: 'cookies', columns: cols, meta: Object.fromEntries(meta.map((m) => [m.key, m.value])) });
const testCfg = path.join(dir, 'config.json');
save('config-key-names-new-profile.json', { profile: 'new profile (signed out)',
  keys: fs.existsSync(testCfg) && fs.statSync(testCfg).size ? Object.keys(JSON.parse(fs.readFileSync(testCfg, 'utf8'))).sort() : [] });
fs.rmSync(dir, { recursive: true, force: true });
console.log(`saved ${fs.readdirSync(out).join(', ')} in ${out}`);
