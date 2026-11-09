# Performance baseline (Phase 7, 2026-11-09)

Read-only round on the installed release: no app code changed. Method and ground rules:
`docs/ideas/performance-and-size.md`. Run again with the same scripts before and after each 1.4 change.

**Machine:** Windows 11 (build 26300). **Launcher:** 1.0.0 (installed release).
**Claude:** 4.23118.0.0 (MSIX, Electron 44.9.3). Medians with p90 and the number of runs (n).

## Raw data and scripts

| File | What |
|---|---|
| `2026-11-09-startup.csv` | 20 launcher starts: `scripts/startup.ps1` |
| `2026-11-09-claude.csv` | Claude with a throwaway profile under `%TEMP%`: `scripts/test-profile.ps1` |
| `2026-11-09-log-history.csv` | Every timed step in the launcher's own log (`sign-in-timings.log`, 0.4.x → 1.0.0, ids masked): `scripts/log-history.cjs` |
| `2026-11-09-updates.csv` | The four self-updates in that log, split into download / install and restart / first start |
| `../../test/fixtures/claude-4.23118.0.0/` | Names-and-shapes fixtures: `scripts/capture-fixtures.cjs` |

`node docs/perf/scripts/summarize.cjs <csv>` prints median / p90 / min / max per column (grouped by `kind`).
`test-profile.ps1` never touches the default profile or `ClaudeProfiles`: it ends only processes whose command
line holds its own `%TEMP%` folder, then deletes the folder.

## Results

| Measurement | Result | n | Source |
|---|---|---|---|
| Normal start: launcher start → cards shown (launcher's clock) | **342 ms** (p90 391) | 20 | startup |
| … app ready / config / window / first state | 168 / 179 / 231 / 317 ms | 20 | startup |
| … window handle seen by Windows (outside clock) | 542 ms (p90 616) | 20 | startup |
| … process query after the cards ("Running" dot) | 908 ms (p90 1139) | 20 | startup |
| … update check (background) | 694 ms (p90 930) | 20 | startup |
| Start over the whole log (all versions, incl. first starts) | 391 ms (p90 1239, max 5794) | 53 | log history |
| First start after an update (new version's cards) | 259–702 ms | 4 | updates |
| Memory, launcher idle with 2 cards (4 processes) | **383 MB** working set, 213 MB private | 20 | startup |
| Open an account, Claude closed: spawn → Claude window visible | **728 ms** (p90 908) | 10 | claude (test profile) |
| Open an account, new profile (first start) | 747 ms (p90 844) | 5 | claude |
| Open an account, already running: second `Claude.exe` hands over and exits | **2624 ms** (p90 2725) | 10 | claude |
| Sign-in window: Add account confirmed → sign-in window ready | **4730 ms** (p90 5788) | 20 | log history |
| … of which closing the main Claude (forced) | 3437 ms (p90 5025) | 21 | log history |
| … find the main profile and Claude.exe / open the sign-in window | 548 / 568 ms | 21 / 20 | log history |
| Sign-in finish (cookie write → move → main profile restored) | 25.3 s (p90 29.5) | 11 | log history |
| … of which waiting for Chromium's cookie write | 24.0 s | 5 | log history |
| Update download (differential, 1.1–1.3 MB) | 2.7–4.6 s | 4 | updates |
| Update install and restart ("installing" → new version starts) | 20.4 / 21.6 / 30.5 s (10.8 s for 0.6.1) | 4 | updates |
| Installer | 121 MB (`Claude-Launcher-Setup-1.0.0.exe`, 121,267,760 bytes) | — | release |
| Installed folder | 371 MB: exe 235 MB, `locales` 48 MB (55 languages, 1 used), `LICENSES.chromium.html` 20 MB, `dxcompiler.dll` 25 MB, `app.asar` 2.8 MB | — | folder |
| Inside `app.asar` (2.8 MB) | js-yaml 0.9 MB, electron-updater 0.5 MB, renderer 0.5 MB (fonts), main 0.1 MB | — | asar header |

"Claude window visible" is Claude's window frame appearing, not its content loaded. The test profile is signed out;
a signed-in profile can take longer to show content. The sign-in and update rows come from real past runs on this PC
across launcher versions 0.4.x–1.0.0 and Claude 3.x–4.x, not from a fresh run (see "Not measured").

## Where the time goes

- **Start** is fast (cards in ~0.35 s). The slow parts happen after the cards: the PowerShell process query (~0.9 s)
  and the update check (~0.7 s), both in the background.
- **Memory** (~383 MB for a launcher with two cards) and **size** (371 MB installed, 48 MB of unused locales) are the
  clearest 1.4 targets; the app's own code is 2.8 MB.
- **Sign-in** is dominated by Claude, not the launcher: ~3.4 s to close the main Claude at the start and ~24 s waiting
  for Chromium to write the session cookie at the finish.
- **Opening an account that is already running** costs ~2.6 s: a whole second `Claude.exe` starts only to hand its
  arguments to the running one. Bringing the existing window to the front directly would skip it.

### What it means for the update progress window (Phase 8)

Of an update's ~25–35 s, the download is only 3–5 s (differential, ~1.2 MB). Most of the wait (20–31 s) is the
silent install and restart, while the launcher itself is **not running**. So the progress must be shown by something
that lives through the install: the installer's own page (option A in `docs/ideas/update-progress.md`). A bar inside
the launcher window would cover only the download.

## Research questions (`docs/ideas/performance-and-size.md`, "Deep study")

Code facts come from reading Claude's own `app.asar` and `ion-dist.asar` in place (read-only, nothing copied or
extracted; `asar` header + text search). Commands with `<exe>` mean
`(Get-AppxPackage -Name Claude).InstallLocation + '\app\Claude.exe'`.

1. **Links per profile — yes (when running), confirmed on a test profile; cold start not confirmed.** Claude takes a
   single-instance lock per `userData` folder, so `<exe> --user-data-dir=<profile> "claude://claude.ai/new"` goes to
   the instance of *that* profile: in the test, `claude.ai/new`, `code/new`, `cowork/new` and
   `claude.ai/settings/usage` each added one line to the test profile's own `logs\main.log`, no new main process
   stayed, the second process exited. With the profile closed, Claude opened (window 741 ms) but no URL-handler line
   was logged, so a cold-start link is unconfirmed. Routes the handler knows: `claude.ai/new`, `claude.ai/chat/<uuid>`,
   `claude.ai/project/<uuid>`, `claude.ai/settings/…`, `claude.ai/customize/…`, `code/new|continue|search`,
   `cowork/new`.
   **Signed-in accounts (2026-11-09):** `claude://claude.ai/new` on "work" (closed → cold start, then again while
   running) started / reached the process of the `work` profile folder only, its window opened ("Claude"), and the
   account in that instance's log matches the work profile's `lastKnownAccountUuid` and differs from Main's
   (compared in a script, values not printed). On Main (`<exe> "claude://claude.ai/new"`, no flag, as the launcher
   opens Main) the second process handed over and exited. The links are logged only at "silly" level and computer
   use cannot see Claude's window, so whether the view switched to a new chat is still to be seen by eye.
2. **Usage page — yes.** `<exe> --user-data-dir=<profile> "claude://claude.ai/settings/usage"`: the handler's
   `settings` case loads `https://claude.ai/settings/usage` in that profile's window, and the bundled front end knows
   the route (21 references). To see once in a signed-in account.
3. **Updates with several instances — partly.** Claude updates through Electron's `autoUpdater`: it asks Windows to
   install the new MSIX, quits, and logs "Still running … after asking Windows to install the update" with the reason
   (Windows refused / did not close the app / no answer). What other instances (other profiles, same package) do to
   that can only be seen during a real Claude update. Check then: `Get-AppxPackage -Name Claude | Select Version` and
   the Claude process list before and after, with and without extra accounts open. "Restart all accounts" waits for
   that observation.
4. **Hidden windows — yes.** Closing Claude's window (WM_CLOSE, like the X) keeps the process running with its window
   hidden (4 titled hidden top-level windows, the same handle). `Get-Process` then reports `MainWindowHandle = 0`, so
   the window must be found with `EnumWindows` + `GetWindowThreadProcessId`. `ShowWindow(handle, SW_SHOW)` shows it
   again, and so does starting `<exe> --user-data-dir=<profile>` again (what the launcher already does). A clean close
   is not possible from outside: WM_CLOSE and `taskkill /PID` without `/F` only hide it (still running after 8 s), so
   force-ending that profile's processes (today's approach) or Claude's tray Quit are the options.
5. **MCP config per profile — yes, inside the profile.** Claude reads `join(app.getPath("userData"),
   "claude_desktop_config.json")`; with `--user-data-dir` that is `<profile>\claude_desktop_config.json`, created on
   the first start (empty). The main one is `%LOCALAPPDATA%\Claude-Data\claude_<PublisherId>\claude_desktop_config.json`.
   Copying MCP servers between accounts = copying the `mcpServers` key between those files (Claude closed).
   (A managed "3p" mode uses `%LOCALAPPDATA%\Claude-3p` instead; not used here.)
6. **First start of a new profile — nothing worth doing ahead.** Window in ~0.75 s; after 15 s the profile holds 445
   files / 24.8 MB and 7 processes, mostly Chromium GPU and shader caches (`GrShaderCache` 5 MB, `GPUCache` 1.6 MB,
   Dawn caches), plus `config.json` with 5 keys. Pre-creating any of it would gain little and risks session data.
7. **What changes between Claude updates.** Seen in two weeks: 3.6556 (Phase 0) → 4.16336 (in the log) → 4.23118.
   - The package folder `Claude_<version>_x64__pzs8sxrjxfjjc` changes on every update; the exe stays `app\Claude.exe`
     in the manifest (the file on disk is `claude.exe`: compare paths case-insensitively, as the code does).
   - Main profile `%LOCALAPPDATA%\Claude-Data\claude_<PublisherId>` (4.x).
   - Account keys in `config.json`: 3.x `oauth:tokenCache*`; 4.4212 `lastKnownAccountUuid` only; 4.23118 has
     `oauth:tokenCache`, `oauth:tokenCacheV2` **and** `lastKnownAccountUuid`.
   - Cookie DB version 24; `name`, `host_key`, `expires_utc`, `value`, `encrypted_value` present.
   - New in the package: alias `claude-desktop.exe`, extra apps (`MakeDataFolder`, `SshAskpass`, `SshProxy`),
     `cowork-svc.exe`, `ion-dist.asar` (the bundled front end).
   Checks for the guard 9 self-check: exe from the manifest exists; main profile folder exists; at least one account
   key name present; those five cookie columns present. All are in the fixtures.
8. **Memory import screen — yes for the memory screen, no for the home card.**
   `<exe> --user-data-dir=<profile> "claude://claude.ai/customize/memory"` (the handler's `customize` case loads that
   route in the profile); `claude://claude.ai/settings/memory` also routes, but in this build it is the old path. No
   link to the "Import memory to Claude" home card was found. To see once in a signed-in account.
9. **Memory menu names — changed already, before "Unified Claude".** In Claude 4.23118 the memory screen is the
   route `/customize/memory` (**Customize → Memory**), with **Export** and **Start import**; `/settings/memory` is
   the old route. The launcher's steps still say "Settings → Memory" (fix in 1.1.x). The exact labels in English and
   Portuguese need a screenshot of the real app (computer use cannot reach Claude's own window), now and again after
   2026-11-10.
10. **Weekly CI canary — not with winget.** `winget show --id Anthropic.Claude` gives version 2.42304.2 as an `exe`
    (the old installer), not the 4.x MSIX; `winget search Claude --source msstore` finds nothing. A runner could only
    install the MSIX from a stable official download URL with `Add-AppxPackage` (not verified). Recommendation: rely
    on the guard 9 self-check on real PCs.
11. **Fixtures — done:** `test/fixtures/claude-4.23118.0.0/`: `appx-packages.json`, `manifest-applications.json`,
    `processes.json` (exe paths, `--flag` names, `--type` and masked `--user-data-dir` only; CLI command lines
    dropped), `config-key-names.json` (main profile, names only, ids masked), `config-key-names-new-profile.json`,
    `cookies-columns.json` (from a throwaway profile).

## Memory assistant review (partial)

Walked on the PC by keyboard up to the card's ⋯ menu → **Receive memories from…**, and stopped there: the next step
(Proceed) opens real accounts in Claude. Found so far:
- The step texts say "Settings → Memory → …"; this Claude has the memory screen under **Customize → Memory**
  (question 9). With question 8, step 1 and step 2 could open `claude://claude.ai/customize/memory` in the right
  account directly instead of describing the menu path.
- The log shows 3 past runs that reached step 1 ("copy") and 2 cancellations; none reached step 2.
- Still to walk: step 1 export and drop, step 2 up to (not including) Confirm; note each manual step and
  its time.

## Not measured (and why)

- **A fresh sign-in run:** it closes the main Claude, which is the app running this session; the 20 past runs in the
  log stand in.
- **A fresh update and the first start after an install:** 1.0.0 is the latest release; the four past updates in the
  log stand in. The next release (1.0.1) logs it again.
- **Opening a real account** (signed in): measured with a signed-out test profile instead.
- **Clicks inside the launcher:** computer use reaches the launcher, but its clicks are refused over the content
  ("Claude overlay"); clicking the title bar and then the keyboard works.
