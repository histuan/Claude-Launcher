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
| **Real default profile** (Phase 4 test, 2026-10-26) | `%LOCALAPPDATA%\Claude-Data\claude_<publisher id>` (here `claude_pzs8sxrjxfjjc` = `PackageFamilyName` lowercased), ~1 GB. The main `Claude.exe` has no `--user-data-dir`; its Chromium children run with `--user-data-dir="%LOCALAPPDATA%\Claude-Data\claude_pzs8sxrjxfjjc"` |
| MSIX LocalCache | `%LOCALAPPDATA%\Packages\Claude_…\LocalCache\Roaming\Claude` and `…\LocalCache\Local\Claude` exist but are **empty** (0 MB) |
| Login cookie | `<profile>\Network\Cookies` (not at the root). `Partitions\launch-preview-*\Network\Cookies` also exist: ignored |
| Claude Code CLI | Its binaries live in the same folder (`<profile>\claude-code\…`) and run from there while desktop sessions are open |
| `<profile>\config.json` after sign-in (0.4.1 test, 2026-10-27) | Holds **both** `oauth:tokenCache` and `oauth:tokenCacheV2`, plus `lastKnownAccountUuid`. These keys can **stay after signing out**, so they are not a signed-in signal: the launcher uses the claude.ai `sessionKey` cookie row (names and hosts only, from a temporary copy of `Network\Cookies`) and falls back to these keys only when the cookie database cannot be read |
| `config.json` as a sign-in signal (0.4.2 test, 2026-10-27) | A **fresh** profile has no `oauth:tokenCache*` keys; right after signing in, `config.json` gets `oauth:tokenCache` and `oauth:tokenCacheV2`. `config.json` is a plain file, readable while Claude runs, so the key **names** appearing are the fast sign-in signal (values are never read). Signing **out** does not change these keys |
| Cookie database while running | `Network\Cookies` is locked while Claude runs and Chromium writes new cookies lazily (about every 30 s, and when it exits normally); a forced end loses cookies not written yet |
| Cookie database lock (0.4.5 test, 2026-10-28) | Every copy fails with `EBUSY` while Claude runs, so a sign-out inside Claude **cannot be detected while the account runs**; only after it is closed. Right after "Close this account" the file stays locked for a few seconds, and the `oauth:tokenCache*` keys (still there after the sign-out) wrongly said "signed in": the keys no longer decide anything |
| Force-end before the cookie commit (0.4.4 build tests, 2026-10-28) | Force-ending ~2 s after the keys, or once the profile folder had been quiet for ~5 s (10–17 s), opened the new account on the **sign-in screen**; the files changed after the keys never included `Network\` (no `Cookies` write yet). With 0.4.3 (force-end after ~35–43 s) it was signed in. **Chromium commits the cookie database about every 30 s, and the desktop sign-in needs that write**: the `oauth:tokenCache*` keys alone are not enough |
| **Claude 4.4212.0.0** (0.4.5 test, 2026-11-01; the app updated from 3.6556) | Same default profile `%LOCALAPPDATA%\Claude-Data\claude_pzs8sxrjxfjjc`; the stash works. After a sign-in on a blank profile, the `config.json` key names matching `oauth`, `Account` or `SignedIn` are only `windowSizeWasSignedIn` and `lastKnownAccountUuid`: **`oauth:tokenCache` / `oauth:tokenCacheV2` no longer exist**, so the 0.4.3 signal never fired ("No sign-in found" though the person was signed in). `Network\Cookies` (28672 bytes) and `Cookies-journal` were written at the time of the sign-in |
| Claude **4.16336.0.0** and slow PowerShell (0.4.5 test, 2026-11-04) | Claude updated itself again (same PackageFamilyName `Claude_pzs8sxrjxfjjc`, `app\Claude.exe` exists). "Sign in" said "Claude is not installed": the lookup took 5069 / 5090 ms, so `powershell.exe` hit the launcher's 5 s timeout (on 2026-11-01 it took 1007 ms). `Get-AppxPackage *Claude*` itself takes 0.17 s in an open PowerShell: the slow part is **starting** `powershell.exe`. Since then: cached path, ~15 s timeout with one retry for this lookup, and a timeout is reported as "Couldn't find Claude in time" |
| Launcher logs (0.4.4 build test) | `%APPDATA%\claude-launcher\` (`sign-in-timings.log`, `sign-in-check.log`), not `%APPDATA%\Multi-Account Launcher for Claude` |
| Close request (0.4.3 test, 2026-10-28) | `taskkill /PID <pid> /T` (no `/F`) **never** closes Claude: it only closes its window and keeps running. `sign-in-timings.log` showed "close main Claude: forced" every time (~8 s with the old ~5 s wait) |
| Reopening Claude while it is being closed (0.4.3 test) | A new default-profile process appears; the 0.4.3 launcher kept trying to close for ~47 s ("still running") and then stopped |
| Desktop sign-in without the cookie (0.4.3 test) | "cookie not written before the force-end: 35260 ms", then a forced end and the move: the account still opened **signed in** and its card did not say "Not signed in". The desktop app's sign-in lives in `config.json` (`oauth:tokenCache*`); waiting for the cookie flush is not needed |
| Closing the window | Claude keeps running **with no window and no tray icon** (0.4.5 test, 2026-11-04: there is no tray icon on Thiago's PC): only Task Manager or "Close this account" in the launcher ends it |
| First open of a freshly signed-in profile | Claude may start without a window; spawning the same command again shows it (single-instance re-activation) |

## 2. macOS guide → Windows

| On macOS | On Windows |
|---|---|
| Never duplicate the `.app` | Same. The folder changes on every MSIX update: the launcher caches `Claude.exe` and its PackageFamilyName in its config, checks the file exists on every launch (no PowerShell), and runs `Get-AppxPackage` again only when it is missing or not cached |
| `open -n -a Claude --args --user-data-dir=...` | Run `Claude.exe` directly. The package launcher fails with `0x800704C7` |
| No single-instance lock → launcher guards with `ps` | Chromium locks per folder: reopening the same profile only focuses its window. Process detection is only for "● Running" |
| Profiles in `~/Library/Application Support/Claude-<Name>` | `%USERPROFILE%\ClaudeProfiles\<id>` (outside `AppData\Roaming`, which MSIX virtualises) |
| Sign-in with only one instance open | **Does not work on Windows** (section 4) |
| `claude_desktop_config.json` (MCP) per profile | Same: each profile starts without MCP. Document it in the README |
| Shared `~/.claude` | Same: `%USERPROFILE%\.claude` is shared by all instances |
| Per-account scheduled tasks | Out of v1 |

Real folder of the default profile (verified on Claude 3.6556.2.0): `%LOCALAPPDATA%\Claude-Data\claude_<id>`.
The old assumption (`%LOCALAPPDATA%\Packages\<PackageFamilyName>\LocalCache\Roaming\Claude`) is wrong on that
version: the folder is empty. The launcher resolves it on every sign-in, never hard-coded, in this order, and accepts a
folder only if it holds `Network\Cookies` (or `Cookies`):

1. the `--user-data-dir` of the running default Claude's children (exe path filter of CLAUDE.md rule 4; the child's
   parent is the flagless main process);
2. `%LOCALAPPDATA%\Claude-Data\<PackageFamilyName lowercased>` (`PackageFamilyName` from `Get-AppxPackage`);
3. any `%LOCALAPPDATA%\Claude-Data\claude_*` folder (stash folders ignored);
4. last fallback: the MSIX LocalCache path above.

No match → sign-in is turned off (Add account / Sign in disabled with a message; opening accounts keeps working) and
the folders checked are written to `sign-in-check.log` in the launcher's `userData` (paths and yes/no only).

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
0. Resolve the default profile folder (§2); none found with confidence → do not start
1. Confirm with the person → close all DEFAULT Claude instances (close request, exit polled every ~250 ms,
   force-end of the default-profile processes only after ~1 s; ~10 s in all)
   → stop at once if a NEW default-profile process appears meanwhile (the person reopened Claude): nothing stashed
   → abort if any process whose exe is inside the profile folder still runs (e.g. Claude Code CLI)
2. Write marker  %LOCALAPPDATA%\ClaudeLauncher\login-pending.json  (state + paths)
3. STASH: rename the default profile folder → "<folder>.launcher-stash"   (same parent: atomic rename)
   e.g. Claude-Data\claude_<id> → Claude-Data\claude_<id>.launcher-stash
4. Open the default Claude (no flag) → starts clean → the person signs in
5. Detect sign-in (automatic) or "I've signed in" button (fallback, read-only: it checks for the saved session for
   ~15 s and, if none, says so and leaves everything as it is) or "Cancel"
6. Wait for the cookie database write: Network\Cookies (or -journal / -wal) gets a newer mtime or another size than
   when the keys appeared (stat only), polled every ~500 ms, max ~45 s; already done if sessionKey is on disk
   → written: wait ~1 s → force-end the default Claude (no close request)
     → move the signed-in folder → %USERPROFILE%\ClaudeProfiles\<id>
   → cap: nothing moves; "The sign-in was not saved yet" → Wait longer (another ~45 s) or Cancel (restore)
7. Undo the stash (rename back) → delete marker → reopen the main Claude
```

Flow rules:

- Before step 3, check disk space and that no default process is alive (a live process = abort).
- The stash is **never** deleted: only renamed back. If renaming back fails, stop and show the exact stash path.
- On startup, the launcher looks for the marker **before anything else**. If it exists: offer "restore main profile" (default)
  or "continue sign-in".
- Cancel at any point = close the default Claude, delete the new folder (it is disposable) and undo the stash.
- The profile folder also holds the Claude Code CLI (`claude-code\…`): the stash moves it too, so nothing may run from it.
- **Sign-in detection (0.4.5, version-tolerant):** when the sign-in window shows (or after the ~8 s window wait),
  the launcher records the account-related key **names** already in the blank profile's `config.json`. While
  waiting (every ~1 s), the person is signed in when a **new** account-related key name appears: any name starting
  with `oauth:` (3.x: `oauth:tokenCache*`), `lastKnownAccountUuid` (4.4212), or any name containing `Account`.
  Values are never read or logged; the log says which key name triggered it (`detect: new account key: …`) and the
  Claude version from the exe path (`start: Claude version: …`). Before 0.4.5 only the 3.x `oauth:tokenCache*`
  names counted (0.4.3). "I've signed in" is the manual fallback (the same new-key signal, or the `sessionKey` text in `<profile>\Network\Cookies`
  plus its `-journal`/`-wal`; `Partitions\*` are ignored). Before 0.4.3 the launcher waited for the lazy cookie
  write, which could take up to a minute. Step timings go to `%APPDATA%\claude-launcher\sign-in-timings.log`.
- **Finish (0.4.4):** the keys are only the start of the sign-in (§1). Step 6 waits for Chromium's cookie commit
  (about every 30 s) before the force-end, logging `finish: wait for the cookie write: written|cap: N ms`. Without
  a write within ~45 s nothing moves and the person chooses Wait longer or Cancel.
- **Card signed-in check (0.4.5):** only a claude.ai `sessionKey` row that is not expired (`expires_utc` in the
  past; 0 = session cookie) and not empty (`length(value)` and `length(encrypted_value)` both 0; lengths only,
  values never read), from a temporary copy of `Network\Cookies` plus its `-journal` / `-wal`. The
  `oauth:tokenCache*` keys **never** decide (they stay after a sign-out). A running account is not read (locked,
  §1): it keeps its last known state. When an account stops running (or the launcher starts), it is read at once;
  if the copy fails, the card keeps its last state with **Checking…**, and the copy is retried every ~1 s for up to
  ~10 s; then the window redraws. Each final decision goes to `sign-in-timings.log`: `card check <id>: cookie found |
  cookie not found | cookie expired | cookie empty | cookie DB unreadable (<reason>) for ~10 s -> kept: signed
  in|not signed in|unknown`. Nothing is ever closed because of this check.
- **Window to the front (0.4.4):** after opening an account or the sign-in window, the launcher (still the foreground
  app) runs PowerShell with `AllowSetForegroundWindow` / `SetForegroundWindow` on that process's main window
  (restored first if minimised). Best effort: a refusal never fails the action.
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

Phase 5 candidate: `config.json` has `lastKnownAccountUuid` (seen in the 0.4.1 test). It may identify the account
without any secret; check whether it maps to the email before trying option 2.

## 6. References

- macOS guide (original source of the idea): chadtimbl.in/writings/claude-workflow-tips.html#multiple-accounts
- https://github.com/Zoltak-Dev/ai-multi-instance (MIT) — snapshot sign-in, detection, per-account usage
- https://github.com/vodongha/claude-desktop-clone — resolving the MSIX exe in PowerShell
