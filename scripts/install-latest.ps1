# Installs the newest Multi-Account Launcher build in one go (testers; see README "For testers: installing a PR build").
# - With an open PR: takes the installer of the newest CI run of that PR, if it is green (via nightly.link, no GitHub login).
# - With no open PR: takes the installer of the latest Release.
# Usage: install-latest.ps1 [-Pr 18] [-DownloadOnly]
param([int]$Pr = 0, [switch]$DownloadOnly)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$repo = 'histuan/Claude-Launcher'
$api = "https://api.github.com/repos/$repo"
$h = @{ 'User-Agent' = 'claude-launcher-installer'; 'Accept' = 'application/vnd.github+json' }
$app = 'Multi-Account Launcher for Claude'

$tmp = Join-Path $env:TEMP ('launcher-install-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Path $tmp | Out-Null
try {
  if ($Pr -gt 0) { $pull = Invoke-RestMethod "$api/pulls/$Pr" -Headers $h }
  else { $pull = @(Invoke-RestMethod "$api/pulls?state=open&sort=updated&direction=desc" -Headers $h) | Select-Object -First 1 }

  if ($pull) {
    Write-Host "PR #$($pull.number): $($pull.title)"
    $sha = $pull.head.sha
    $runs = (Invoke-RestMethod "$api/actions/runs?head_sha=$sha&per_page=20" -Headers $h).workflow_runs |
      Where-Object { $_.path -eq '.github/workflows/claude-launcher.yml' } | Sort-Object created_at -Descending
    $run = $runs | Select-Object -First 1
    if (-not $run) { throw "No CI run yet for the latest commit ($($sha.Substring(0,7))). Wait a minute and try again." }
    if ($run.status -ne 'completed') { throw "CI is still running for $($sha.Substring(0,7)) ($($run.status)). Try again in a few minutes." }
    if ($run.conclusion -ne 'success') { throw "CI failed for $($sha.Substring(0,7)) ($($run.conclusion)): $($run.html_url)" }
    Write-Host "Commit $($sha.Substring(0,7)), CI green. Downloading the installer..."
    $zip = Join-Path $tmp 'installer.zip'
    Invoke-WebRequest -UseBasicParsing "https://nightly.link/$repo/actions/runs/$($run.id)/launcher-installer.zip" -OutFile $zip
    Expand-Archive -LiteralPath $zip -DestinationPath $tmp
  } else {
    $rel = Invoke-RestMethod "$api/releases?per_page=1" -Headers $h | Select-Object -First 1
    $asset = $rel.assets | Where-Object { $_.name -like '*.exe' } | Select-Object -First 1
    Write-Host "No open PR. Latest release: $($rel.tag_name). Downloading..."
    Invoke-WebRequest -UseBasicParsing $asset.browser_download_url -OutFile (Join-Path $tmp $asset.name)
  }

  $exe = Get-ChildItem -LiteralPath $tmp -Filter '*.exe' -Recurse | Select-Object -First 1
  if (-not $exe) { throw 'The download has no installer .exe.' }
  Write-Host "Got $($exe.Name)."
  if ($DownloadOnly) {
    # Copied out before the temp folder is deleted (finally below).
    $saved = Join-Path (Join-Path $env:USERPROFILE 'Downloads') $exe.Name
    Copy-Item -LiteralPath $exe.FullName -Destination $saved -Force
    Write-Host "Download only: not installing. Saved to $saved"
    return
  }

  Get-Process -Name $app -ErrorAction SilentlyContinue | Stop-Process -Force
  Start-Sleep -Milliseconds 800
  Write-Host 'Installing...'
  Start-Process -FilePath $exe.FullName -ArgumentList '/S' -Wait
  $lnk = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\$app.lnk"
  if (Test-Path -LiteralPath $lnk) { Start-Process $lnk; Write-Host 'Installed and opened.' }
  else { Write-Host 'Installed. Open it from the Start menu.' }
} catch {
  Write-Host ('ERROR: ' + $_.Exception.Message) -ForegroundColor Red
} finally {
  Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
}
