# Baseline: start the installed launcher N times and record the timings (read-only).
# Per run: process start -> main window handle (outside view), the launcher's own "startup:" log lines,
# the update check time, and the working set of all launcher processes after ~5 s idle. Then closes it.
# Usage: powershell -NoProfile -File docs\perf\scripts\startup.ps1 -Runs 20 -Out docs\perf\<date>-startup.csv
param([int]$Runs = 20, [string]$Out = "startup.csv", [int]$IdleSeconds = 5)
$ErrorActionPreference = 'Stop'
[Threading.Thread]::CurrentThread.CurrentCulture = [Globalization.CultureInfo]::InvariantCulture
$exe = Join-Path $env:LOCALAPPDATA 'Programs\Multi-Account Launcher for Claude\Multi-Account Launcher for Claude.exe'
$log = Join-Path $env:APPDATA 'claude-launcher\sign-in-timings.log'
function Launchers { Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $exe } }
function NewLines($skip) { if (Test-Path $log) { @(Get-Content $log | Select-Object -Skip $skip) } else { @() } }
function Ms($text, $pattern) { if ($text -match $pattern) { [int]$Matches[1] } else { '' } }

if (Launchers) { throw 'Close the launcher first.' }
$rows = @()
for ($i = 1; $i -le $Runs; $i++) {
  $skip = @(Get-Content $log -ErrorAction SilentlyContinue).Count
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $p = Start-Process -FilePath $exe -PassThru
  $windowMs = ''; $cardsSeenMs = ''; $cards = ''; $query = ''; $update = ''
  while ($sw.ElapsedMilliseconds -lt 20000) {
    $p.Refresh()
    if ($windowMs -eq '' -and $p.MainWindowHandle -ne 0) { $windowMs = $sw.ElapsedMilliseconds }
    $new = (NewLines $skip) -join "`n"
    if ($cardsSeenMs -eq '' -and $new -match 'startup: cards shown') { $cardsSeenMs = $sw.ElapsedMilliseconds }
    if ($cardsSeenMs -ne '' -and $new -match 'startup: process query' -and $new -match 'update: check') { break }
    Start-Sleep -Milliseconds 25
  }
  Start-Sleep -Seconds $IdleSeconds
  $procs = @(Launchers)
  $wsMb = [math]::Round((($procs | Measure-Object WorkingSet64 -Sum).Sum) / 1MB, 1)
  $privMb = [math]::Round((($procs | Measure-Object PrivateMemorySize64 -Sum).Sum) / 1MB, 1)
  $new = (NewLines $skip) -join "`n"
  $rows += [pscustomobject]@{
    run = $i
    window_handle_ms = $windowMs
    cards_line_seen_ms = $cardsSeenMs
    cards_shown_ms = Ms $new 'cards shown: (\d+) ms'
    app_ready_ms = Ms $new 'app ready (\d+) ms'
    config_ms = Ms $new 'config (\d+) ms'
    window_ms = Ms $new 'window (\d+) ms'
    first_state_ms = Ms $new 'first state (\d+) ms'
    process_query_ms = Ms $new 'process query: (\d+) ms'
    update_check_ms = Ms $new 'update: check: [^\n]*\((\d+) ms\)'
    processes = $procs.Count
    working_set_mb = $wsMb
    private_mb = $privMb
  }
  foreach ($q in $procs) { [void]$q.CloseMainWindow() }
  $t = [Diagnostics.Stopwatch]::StartNew()
  while ((Launchers) -and $t.ElapsedMilliseconds -lt 5000) { Start-Sleep -Milliseconds 100 }
  Launchers | Stop-Process -Force
  Start-Sleep -Seconds 1
  Write-Host "run $i done"
}
$rows | Export-Csv -NoTypeInformation -Encoding UTF8 $Out
