# Baseline + research with a throwaway Claude profile under %TEMP% (never the default profile, never ClaudeProfiles).
# Only processes whose command line contains the test folder are ended. Signed out: no account data is involved.
# Usage: powershell -NoProfile -File docs\perf\scripts\test-profile.ps1 -Cold 5 -Warm 10 -Out docs\perf\<date>-claude.csv
param([int]$Cold = 5, [int]$Warm = 10, [string]$Out = "claude.csv", [int]$Settle = 15)
$ErrorActionPreference = 'Stop'
[Threading.Thread]::CurrentThread.CurrentCulture = [Globalization.CultureInfo]::InvariantCulture
$root = Join-Path $env:TEMP 'claude-launcher-perf'
$dir = Join-Path $root 'profile'
$pkg = Get-AppxPackage -Name Claude | Select-Object -First 1
$exe = Join-Path $pkg.InstallLocation 'app\Claude.exe'
Add-Type -Namespace Perf -Name W -MemberDefinition @'
[DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc f, IntPtr l);
public delegate bool EnumProc(IntPtr h, IntPtr l);
[DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
[DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
[DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr h);
[DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
public static System.Collections.Generic.List<IntPtr> Of(uint target) {
  var r = new System.Collections.Generic.List<IntPtr>();
  EnumWindows((h, l) => { uint p; GetWindowThreadProcessId(h, out p); if (p == target && GetWindowTextLength(h) > 0) r.Add(h); return true; }, IntPtr.Zero);
  return r;
}
'@
function Mains { @(Get-CimInstance Win32_Process -Filter "Name='claude.exe'" | Where-Object { $_.CommandLine -like "*$dir*" -and $_.CommandLine -notlike '*--type=*' }) }
function All { @(Get-CimInstance Win32_Process -Filter "Name='claude.exe'" | Where-Object { $_.CommandLine -like "*$dir*" }) }
function Visible($procId) { @([Perf.W]::Of([uint32]$procId) | Where-Object { [Perf.W]::IsWindowVisible($_) }) }
function StopTest { All | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; Start-Sleep -Milliseconds 800 }
function Clean { StopTest; for ($k = 0; $k -lt 10 -and (Test-Path $dir); $k++) { Remove-Item $dir -Recurse -Force -ErrorAction SilentlyContinue; Start-Sleep -Milliseconds 500 } }
function Launch([string[]]$extra) {
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $p = Start-Process -FilePath $exe -ArgumentList (@("--user-data-dir=`"$dir`"") + $extra) -PassThru
  $vis = ''
  while ($sw.ElapsedMilliseconds -lt 30000) {
    if ((Visible $p.Id).Count -gt 0) { $vis = $sw.ElapsedMilliseconds; break }
    if ($p.HasExited) { break }
    Start-Sleep -Milliseconds 25
  }
  [pscustomobject]@{ proc = $p; visible_ms = $vis; exited = $p.HasExited }
}
function LogHits($pattern) { $f = Join-Path $dir 'logs\main.log'; if (Test-Path $f) { @(Select-String -Path $f -Pattern $pattern).Count } else { 'no main.log' } }

if (All) { throw 'A test-profile Claude is already running.' }
"claude $($pkg.Version), exe $exe"
$rows = @()
# 1. First start of a new profile (cold), then what it created.
for ($i = 1; $i -le $Cold; $i++) {
  Clean
  $r = Launch @()
  Start-Sleep -Seconds $Settle
  $files = @(Get-ChildItem $dir -Recurse -Force -File -ErrorAction SilentlyContinue)
  $mb = [math]::Round((($files | Measure-Object Length -Sum).Sum) / 1MB, 1)
  $rows += [pscustomobject]@{ kind = 'new_profile'; run = $i; visible_ms = $r.visible_ms; files = $files.Count; mb = $mb; processes = @(All).Count }
  if ($i -eq $Cold) {
    "top-level entries after first start:"
    Get-ChildItem $dir -Force | ForEach-Object { $s = (Get-ChildItem $_.FullName -Recurse -Force -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum; "  $($_.Name)$(if ($_.PSIsContainer) {'\'}) $([math]::Round($s / 1KB)) KB" }
    "claude_desktop_config.json in the profile: $(Test-Path (Join-Path $dir 'claude_desktop_config.json'))"
  }
}
# 2. Existing profile, Claude closed (warm start).
for ($i = 1; $i -le $Warm; $i++) {
  StopTest
  $r = Launch @()
  $rows += [pscustomobject]@{ kind = 'existing_profile'; run = $i; visible_ms = $r.visible_ms; files = ''; mb = ''; processes = @(All).Count }
  Start-Sleep -Seconds 3
}
# 3. Already running: a second start hands its arguments to the running instance and exits.
for ($i = 1; $i -le $Warm; $i++) {
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $p = Start-Process -FilePath $exe -ArgumentList "--user-data-dir=`"$dir`"" -PassThru
  $p.WaitForExit(15000) | Out-Null
  $rows += [pscustomobject]@{ kind = 'already_running_handoff'; run = $i; visible_ms = $sw.ElapsedMilliseconds; files = ''; mb = ''; processes = @(Mains).Count }
  Start-Sleep -Milliseconds 500
}
$rows | Export-Csv -NoTypeInformation -Encoding UTF8 $Out

# 4. claude:// links per profile (Q1): running, then cold. Evidence = the profile's own main.log.
"--- Q1 links"
$before = LogHits 'claudeURLHandler|deep link|second-instance|open-url'
foreach ($u in 'claude://claude.ai/new', 'claude://code/new', 'claude://cowork/new', 'claude://claude.ai/settings/usage') {
  $p = Start-Process -FilePath $exe -ArgumentList "--user-data-dir=`"$dir`"", $u -PassThru; $p.WaitForExit(15000) | Out-Null
  Start-Sleep -Seconds 2
  "running instance, $u : second process exited=$($p.HasExited), main processes=$(@(Mains).Count), handler lines so far=$(LogHits 'claudeURLHandler|deep link|second-instance|open-url') (before $before)"
}
StopTest
$r = Launch @('claude://claude.ai/new'); Start-Sleep -Seconds 8
"cold start with claude://claude.ai/new: visible after $($r.visible_ms) ms, handler lines=$(LogHits 'claudeURLHandler|deep link|second-instance|open-url'), cold-start lines=$(LogHits 'cold_start|coldStart')"

# 5. Hidden windows (Q4): close the window, look for the process and its hidden window, show it again.
"--- Q4 hidden windows"
$main = @(Mains)[0].ProcessId
$h = (Visible $main)[0]
[void][Perf.W]::PostMessage($h, 0x10, [IntPtr]::Zero, [IntPtr]::Zero)  # WM_CLOSE, like the window's X
Start-Sleep -Seconds 3
$hidden = @([Perf.W]::Of([uint32]$main) | Where-Object { -not [Perf.W]::IsWindowVisible($_) })
"after WM_CLOSE: process alive=$([bool](Get-Process -Id $main -ErrorAction SilentlyContinue)), visible windows=$((Visible $main).Count), hidden titled windows=$($hidden.Count), same handle hidden=$($hidden -contains $h)"
[void][Perf.W]::ShowWindow($h, 5)  # SW_SHOW
Start-Sleep -Seconds 1
"after ShowWindow(SW_SHOW) on that handle: visible=$([Perf.W]::IsWindowVisible($h))"
[void][Perf.W]::PostMessage($h, 0x10, [IntPtr]::Zero, [IntPtr]::Zero); Start-Sleep -Seconds 2
$p = Start-Process -FilePath $exe -ArgumentList "--user-data-dir=`"$dir`"" -PassThru; $p.WaitForExit(15000) | Out-Null; Start-Sleep -Seconds 2
"hidden, then started again with the same profile: visible windows=$((Visible $main).Count)"
$sw = [Diagnostics.Stopwatch]::StartNew()
& taskkill.exe /PID $main 2>&1 | Out-Null
while ((Get-Process -Id $main -ErrorAction SilentlyContinue) -and $sw.ElapsedMilliseconds -lt 8000) { Start-Sleep -Milliseconds 100 }
"taskkill without /F: process gone=$(-not (Get-Process -Id $main -ErrorAction SilentlyContinue)) after $($sw.ElapsedMilliseconds) ms"
Clean
"test profile removed: $(-not (Test-Path $dir))"
