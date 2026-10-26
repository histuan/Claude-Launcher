# Windows — verified facts and technical design

Windows adaptation of the macOS guide "Run a Separate Claude Desktop App for Each Claude Account"
(chadtimbl.in), plus what was verified on Thiago's PC and in third-party projects.

## 1. Verified on Thiago's PC (Phase 0, 2026-10-26, Claude 3.6556.2.0)

| Test | Result |
|---|---|
| `Get-AppxPackage *Claude*` | MSIX install at `C:\Program Files\WindowsApps\Claude_3.6556.2.0_x64__pzs8sxrjxfjjc` |
| `<InstallLocation>\app\Claude.exe` exists | Yes |
| Running the exe directly with `--user-data-dir=%USERPROFILE%\ClaudeProfiles\test` | Opened a **2nd window**, isolated (welcome screen, signed out), while the main one stayed open and signed in |
| Profile folder | Created and populated (`Cache`, `IndexedDB`, `GPUCache`...) |
| Running again with the **same** folder | Did **not** open a 3rd window. The 2nd process prints "Access denied" cache errors and exits: expected noise, the lock is per folder |
| `claude.exe` process list | 1 main without flag, 1 with `--user-data-dir`, and **Claude Code CLI processes** also named `claude.exe` (under `%LOCALAPPDATA%\Claude-Data\...\claude-code\...`) |
| `Win32_UserAccount.FullName` | `"histuan ."` (not the real name; that is why the greeting is editable) |
| App console output | `MaxListenersExceededWarning` warnings from Claude itself: harmless. The launcher opens Claude with `stdio: 'ignore'` |

## 2. macOS guide → Windows

| On macOS | On Windows |
|---|---|
| Never duplicate the `.app` | Same. Resolve `Claude.exe` on every launch (the folder changes on every MSIX update) |
| `open -n -a Claude --args --user-data-dir=...` | Run `Claude.exe` directly. The package launcher fails with `0x800704C7` |
| No single-instance lock → launcher guards with `ps` | Chromium locks per folder: reopening the same profile only focuses its window. Process detection is only for "● Running" |
| Profiles in `~/Library/Application Support/Claude-<Name>` | `%USERPROFILE%\ClaudeProfiles\<id>` (outside `AppData\Roaming`, which MSIX virtualises) |
| Sign-in with only one instance open | **Does not work on Windows** (section 4) |
| `claude_desktop_config.json` (MCP) per profile | Same: each profile starts without MCP. Document it in the README |
| Shared `~/.claude` | Same: `%USERPROFILE%\.claude` is shared by all instances |
| Per-account scheduled tasks | Out of v1 |

Real folder of the default profile (MSIX redirects `%APPDATA%\Claude`):
`%LOCALAPPDATA%\Packages\<PackageFamilyName>\LocalCache\Roaming\Claude`.
Get `PackageFamilyName` from `Get-AppxPackage` (on Thiago's PC: `Claude_pzs8sxrjxfjjc`), never hard-coded.

Known limitation: local agent mode uses **one VM per machine**; only one instance can use it at a time.

## 3. Reference commands (PowerShell)

```powershell
# Resolve the app
$pkg = Get-AppxPackage *Claude* | Select-Object -First 1
$pkg | Select-Object Name, Version, InstallLocation, PackageFamilyName | ConvertTo-Json

# Main Claude Desktop processes (filter by path, never by name alone)
Get-CimInstance Win32_Process -Filter "Name='claude.exe'" |
  Where-Object { $_.ExecutablePath -like '*\WindowsApps\Claude_*\app\Claude.exe' -and $_.CommandLine -notmatch '--type=' } |
  Select-Object ProcessId, CommandLine | ConvertTo-Json
```

Call PowerShell with `-NoProfile -NonInteractive -Command` and request JSON output.
Fallback for an old (non-MSIX) install: `%LOCALAPPDATA%\AnthropicClaude\claude.exe`.

## 4. Signing in extra accounts (snapshot flow)

**Problem:** the sign-in callback (`claude://`, by email or Google) is delivered by Windows to the **MSIX package**, which
always activates the **default** instance. An extra profile never receives the sign-in by itself. Redirecting the protocol
per profile is not possible on current Windows. Source: README of `Zoltak-Dev/ai-multi-instance` (MIT) and a Reddit report.

**Solution** (same idea as ai-multi-instance; credit it in the README):

```
1. Confirm with the person → close all DEFAULT Claude instances
2. Write marker  %LOCALAPPDATA%\ClaudeLauncher\login-pending.json  (state + paths)
3. STASH: rename the default profile folder → "Claude.launcher-stash"   (same volume: atomic rename)
4. Open the default Claude (no flag) → starts clean → the person signs in
5. Detect sign-in (automatic) or "I've signed in" button (fallback) or "Cancel"
6. Close the default Claude → move the signed-in folder → %USERPROFILE%\ClaudeProfiles\<id>
7. Undo the stash (rename back) → delete marker → reopen the main Claude
```

Flow rules:

- Before step 3, check disk space and that no default process is alive (a live process = abort).
- The stash is **never** deleted: only renamed back. If renaming back fails, stop and show the exact stash path.
- On startup, the launcher looks for the marker **before anything else**. If it exists: offer "restore main profile" (default)
  or "continue sign-in".
- Cancel at any point = close the default Claude, delete the new folder (it is disposable) and undo the stash.
- **Sign-in detection:** the app is signed in when the `sessionKey` cookie exists. The cookie database is locked while the app
  is open, so watch for changes in the cookie database and its `-journal`/`-wal`, together with the profile's `config.json`
  (a plain file, readable while the app is open), ignoring writes at app startup. See how ai-multi-instance does it
  (`engine.py`) before inventing anything. Always keep the manual button.
- Moving the session to another folder works: DPAPI encryption is per Windows user, not per folder.

## 5. Account details (email and real name)

Order of attempts, stopping at the first that works:

1. **Local, non-secret** profile files (e.g. `config.json`, Local Storage) that already contain email and name.
   The cloud cannot see Thiago's PC: the phase writes a diagnostic script that lists **only keys and paths, never token
   values**; Thiago runs it and pastes the output.
2. `sessionKey` cookie (DPAPI + AES-GCM, via PowerShell/.NET) + undocumented `claude.ai` endpoint
   (see `usage.py` in ai-multi-instance). May break with updates: handle errors and fall back to 3.
3. Manual: the person types the email when adding the account.

Store only email and name in the launcher config. Never store the token.

## 6. References

- macOS guide (original source of the idea): chadtimbl.in/writings/claude-workflow-tips.html#multiple-accounts
- https://github.com/Zoltak-Dev/ai-multi-instance (MIT) — snapshot sign-in, detection, per-account usage
- https://github.com/vodongha/claude-desktop-clone — resolving the MSIX exe in PowerShell
