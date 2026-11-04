# Phase 5 diagnostic (docs/WINDOWS.md §5): where does a Claude profile keep the account's e-mail and name?
# Read-only. Prints ONLY file paths, sizes, key names and value shapes - never token, cookie or config values.
# A value that looks like an e-mail is printed only masked (t***@g***.com). The cookie database is never opened.
#
# Run (Windows PowerShell 5.1 or PowerShell 7), ideally with Claude fully closed (some files are locked while it runs):
#   powershell -NoProfile -ExecutionPolicy Bypass -File diagnose-accounts.ps1
# The report is also written to %TEMP%\claude-launcher-diagnose.txt and copied to the clipboard.

$ErrorActionPreference = 'Stop'
$out = New-Object System.Collections.Generic.List[string]
function Say([string]$line) { $out.Add($line); Write-Host $line }

$emailRx = [regex]'[A-Za-z0-9._%+\-]{1,64}@[A-Za-z0-9\-]{1,63}(?:\.[A-Za-z0-9\-]{1,63})*\.[A-Za-z]{2,12}'
$uuidRx = [regex]'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
# A key name is printed only if it looks like an identifier and holds no long random run (could be a token).
$keyRx = [regex]'^[A-Za-z_$][A-Za-z0-9_:.\-$]{0,59}$'
$longRunRx = [regex]'[A-Za-z0-9+/=_\-]{24,}'
# "name@2x.png" and similar file names are not e-mails.
$fileNameRx = '(?i)\.(png|jpe?g|gif|svg|webp|ico|js|mjs|css|json|map|html?|woff2?|ttf)$'

function Mask-Email([string]$e) {
  $at = $e.IndexOf('@')
  $local = $e.Substring(0, $at)
  $domain = $e.Substring($at + 1)
  $dot = $domain.LastIndexOf('.')
  $tld = $domain.Substring($dot)
  return $local.Substring(0, 1) + '***@' + $domain.Substring(0, 1) + '***' + $tld
}

function Safe-Key([string]$k) {
  if ($keyRx.IsMatch($k) -and -not $longRunRx.IsMatch($k)) { return $k }
  return '<key not shown, ' + $k.Length + ' chars>'
}

# Shape of a value, never the value itself.
function Shape($v) {
  if ($null -eq $v) { return 'null' }
  if ($v -is [string]) {
    $m = $emailRx.Match($v)
    if ($m.Success -and $m.Value.Length -eq $v.Length) { return 'e-mail ' + (Mask-Email $v) }
    if ($m.Success) { return 'string(' + $v.Length + ') containing e-mail ' + (Mask-Email $m.Value) }
    if ($uuidRx.IsMatch($v)) { return 'uuid' }
    return 'string(' + $v.Length + ')'
  }
  if ($v -is [bool]) { return 'bool' }
  if ($v -is [int] -or $v -is [long] -or $v -is [double] -or $v -is [decimal]) { return 'number' }
  if ($v -is [array]) { return 'array(' + $v.Count + ')' }
  return 'object'
}

# Key paths of a parsed JSON object (depth <= 4). $filter: only paths whose name matches it ($null = all).
function Walk($obj, [string]$prefix, [int]$depth, $filter, $lines) {
  if ($depth -gt 4 -or $null -eq $obj -or $obj -isnot [System.Management.Automation.PSCustomObject]) { return }
  foreach ($p in $obj.PSObject.Properties) {
    $path = if ($prefix) { $prefix + '.' + (Safe-Key $p.Name) } else { Safe-Key $p.Name }
    $v = $p.Value
    if ($null -eq $filter -or $path -match $filter -or ($v -is [string] -and $emailRx.IsMatch($v))) {
      $lines.Add('    ' + $path + ' : ' + (Shape $v))
    }
    if ($v -is [System.Management.Automation.PSCustomObject]) { Walk $v $path ($depth + 1) $filter $lines }
    elseif ($v -is [array] -and $v.Count -gt 0 -and $v[0] -is [System.Management.Automation.PSCustomObject]) {
      Walk $v[0] ($path + '[0]') ($depth + 1) $filter $lines
    }
  }
}

function Read-Shared([string]$file) {
  $fs = [System.IO.File]::Open($file, 'Open', 'Read', 'ReadWrite, Delete')
  try {
    $buf = New-Object byte[] $fs.Length
    $read = 0
    while ($read -lt $buf.Length) {
      $n = $fs.Read($buf, $read, $buf.Length - $read)
      if ($n -le 0) { break }
      $read += $n
    }
    return ,$buf # the comma keeps the byte array whole (PowerShell would unroll it)
  } finally { $fs.Close() }
}

function Report-Json([string]$file, [string]$rel, $filter) {
  try {
    $text = [System.IO.File]::ReadAllText($file)
    $json = $text | ConvertFrom-Json
  } catch {
    Say ('  ' + $rel + ' : could not parse (' + $_.Exception.GetType().Name + ')')
    return
  }
  $lines = New-Object System.Collections.Generic.List[string]
  Walk $json '' 0 $filter $lines
  $what = if ($null -eq $filter) { 'all keys' } else { 'keys about account/user/name/e-mail' }
  Say ('  ' + $rel + ' (' + (Get-Item -LiteralPath $file).Length + ' bytes, ' + $what + '):')
  if ($lines.Count -eq 0) { Say '    (none)' }
  $shown = 0
  foreach ($l in $lines) {
    if ($shown -ge 80) { Say ('    ... ' + ($lines.Count - 80) + ' more'); break }
    Say $l
    $shown++
  }
}

# Binary stores (Local Storage / Session Storage / IndexedDB are LevelDB): text is Latin-1 or UTF-16LE inside.
# For each e-mail found: masked value, file, and the JSON-looking key names right before/after it (names only).
function Scan-Store([string]$dir, [string]$profileRoot, [string]$uuid) {
  if (-not (Test-Path -LiteralPath $dir)) { return }
  $rel = $dir.Substring($profileRoot.Length).TrimStart('\')
  $files = @(Get-ChildItem -LiteralPath $dir -File -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.Length -le 20MB -and $_.Name -notmatch '^(LOCK|LOG|LOG\.old|CURRENT)$' })
  $total = ($files | Measure-Object -Property Length -Sum).Sum
  Say ('  ' + $rel + ' (' + $files.Count + ' files, ' + [int]($total / 1KB) + ' KB):')
  $hits = @{}
  $claudeKeys = New-Object System.Collections.Generic.HashSet[string]
  $locked = 0
  $uuidFiles = 0
  foreach ($f in $files) {
    try { $bytes = Read-Shared $f.FullName } catch { $locked++; continue }
    $texts = @(
      [System.Text.Encoding]::GetEncoding(28591).GetString($bytes),
      [System.Text.Encoding]::Unicode.GetString($bytes)
    )
    if ($bytes.Length -gt 1) { $texts += [System.Text.Encoding]::Unicode.GetString($bytes, 1, $bytes.Length - 1) }
    $hasUuid = $false
    foreach ($t in $texts) {
      if ($uuid -and $t.Contains($uuid)) { $hasUuid = $true }
      # Local Storage key names of claude.ai: "_https://claude.ai" + 0x00 + 0x01 + key.
      foreach ($m in [regex]::Matches($t, '_https://claude\.ai\x00\x01([A-Za-z0-9_:.\-$]{1,60})')) {
        [void]$claudeKeys.Add((Safe-Key $m.Groups[1].Value))
      }
      foreach ($m in $emailRx.Matches($t)) {
        if ($m.Value -match $fileNameRx) { continue } # e.g. icon@2x.png
        $masked = Mask-Email $m.Value
        if (-not $hits.ContainsKey($masked)) {
          $hits[$masked] = @{ files = (New-Object System.Collections.Generic.HashSet[string]); keys = (New-Object System.Collections.Generic.HashSet[string]); nearUuid = $false }
        }
        $h = $hits[$masked]
        [void]$h.files.Add($f.Name)
        $from = [Math]::Max(0, $m.Index - 400)
        $win = $t.Substring($from, [Math]::Min($t.Length - $from, 800 + $m.Length))
        foreach ($k in [regex]::Matches($win, '"([A-Za-z_][A-Za-z0-9_]{1,40})"\s*:')) {
          if ($h.keys.Count -lt 25) { [void]$h.keys.Add((Safe-Key $k.Groups[1].Value)) }
        }
        if ($uuid) {
          $from2 = [Math]::Max(0, $m.Index - 2000)
          if ($t.Substring($from2, [Math]::Min($t.Length - $from2, 4000)).Contains($uuid)) { $h.nearUuid = $true }
        }
      }
    }
    if ($hasUuid) { $uuidFiles++ }
  }
  if ($locked -gt 0) { Say ('    locked files skipped: ' + $locked + ' (close Claude and run again to read them)') }
  if ($uuid) { Say ('    files containing lastKnownAccountUuid: ' + $uuidFiles) }
  if ($claudeKeys.Count -gt 0) {
    Say ('    claude.ai Local Storage key names (' + $claudeKeys.Count + '): ' + (($claudeKeys | Sort-Object | Select-Object -First 60) -join ', '))
  }
  if ($hits.Count -eq 0) { Say '    e-mails: none' }
  foreach ($masked in ($hits.Keys | Sort-Object)) {
    $h = $hits[$masked]
    Say ('    e-mail ' + $masked + ' in ' + (($h.files | Sort-Object) -join ', ') + '; near the account uuid: ' + $h.nearUuid)
    if ($h.keys.Count -gt 0) { Say ('      key names around it: ' + (($h.keys | Sort-Object) -join ', ')) }
  }
}

function Report-Profile([string]$label, [string]$dir) {
  Say ''
  Say ('== ' + $label + ': ' + $dir.Replace($env:LOCALAPPDATA, '%LOCALAPPDATA%').Replace($env:USERPROFILE, '%USERPROFILE%'))
  if (-not (Test-Path -LiteralPath $dir)) { Say '  (missing)'; return }
  $uuid = $null
  $cfg = Join-Path $dir 'config.json'
  if (Test-Path -LiteralPath $cfg) {
    Report-Json $cfg 'config.json' $null
    try {
      $v = ([System.IO.File]::ReadAllText($cfg) | ConvertFrom-Json).lastKnownAccountUuid
      if ($v -is [string] -and $uuidRx.IsMatch($v)) { $uuid = $v }
    } catch { }
  } else { Say '  config.json : missing' }
  foreach ($j in @(Get-ChildItem -LiteralPath $dir -File -Filter '*.json' -ErrorAction SilentlyContinue)) {
    if ($j.Name -ne 'config.json') { Report-Json $j.FullName $j.Name '(?i)mail|name|account|user|profile|org|login' }
  }
  foreach ($name in @('Preferences', 'Local State')) {
    $p = Join-Path $dir $name
    if (Test-Path -LiteralPath $p) { Report-Json $p $name '(?i)mail|account_info|full_name|given_name|gaia|signin' }
  }
  Scan-Store (Join-Path $dir 'Local Storage') $dir $uuid
  Scan-Store (Join-Path $dir 'Session Storage') $dir $uuid
  foreach ($idb in @(Get-ChildItem -LiteralPath (Join-Path $dir 'IndexedDB') -Directory -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -like '*claude*' })) {
    Scan-Store $idb.FullName $dir $uuid
  }
  # Other top-level folders, sizes only (to know what else exists).
  $folders = @(Get-ChildItem -LiteralPath $dir -Directory -ErrorAction SilentlyContinue | ForEach-Object { $_.Name })
  Say ('  folders: ' + ($folders -join ', '))
}

Say ('Multi-Account Launcher - account details diagnostic, ' + (Get-Date -Format 'yyyy-MM-dd HH:mm'))
Say ('PowerShell ' + $PSVersionTable.PSVersion.ToString())
try {
  $pkg = Get-AppxPackage *Claude* | Where-Object { $_.InstallLocation -and (Test-Path -LiteralPath (Join-Path $_.InstallLocation 'app\Claude.exe')) } | Select-Object -First 1
  if ($pkg) { Say ('Claude ' + $pkg.Version + ' (' + $pkg.PackageFamilyName + ')') } else { Say 'Claude MSIX package: not found' }
} catch { Say ('Claude MSIX package: lookup failed (' + $_.Exception.GetType().Name + ')') }
$running = @(Get-CimInstance Win32_Process -Filter "Name='claude.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.ExecutablePath -like '*\WindowsApps\Claude_*\app\Claude.exe' -and $_.CommandLine -notmatch '--type=' })
Say ('Claude main processes running now: ' + $running.Count + $(if ($running.Count -gt 0) { ' (close them for a full read)' } else { '' }))

$data = Join-Path $env:LOCALAPPDATA 'Claude-Data'
foreach ($d in @(Get-ChildItem -LiteralPath $data -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like 'claude_*' -and $_.Name -notlike '*.launcher-stash' })) {
  Report-Profile 'Main (default profile)' $d.FullName
}
foreach ($d in @(Get-ChildItem -LiteralPath (Join-Path $env:USERPROFILE 'ClaudeProfiles') -Directory -ErrorAction SilentlyContinue)) {
  Report-Profile ('Extra account "' + $d.Name + '"') $d.FullName
}

$file = Join-Path $env:TEMP 'claude-launcher-diagnose.txt'
[System.IO.File]::WriteAllLines($file, $out)
try { $out -join "`r`n" | Set-Clipboard; $copied = ' and copied to the clipboard' } catch { $copied = '' }
Write-Host ''
Write-Host ('Report saved to ' + $file + $copied + '. Paste it in the Claude Code session.')
