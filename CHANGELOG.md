# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Releases are tagged `vX.Y.Z` (up to 0.4.5: `launcher-vX.Y.Z`).

## [Unreleased]

## [1.0.1] - 2026-11-10

Resilience against Claude updates: anything the launcher reads from Claude can change in an update; when it does, the
launcher degrades instead of breaking (`docs/ideas/resilience.md`).

### Changed

- A click on a card always opens that account, also one marked **Not signed in** (Claude shows its own sign-in).
  **Sign in again** is in the card's ⋯ menu for every extra account.
- **Not signed in** needs two signals to agree: no session cookie and no account keys in the profile's `config.json`
  (names only). When they disagree the state is unknown and the card shows nothing. A sign-out inside Claude keeps
  those keys, so it now shows as unknown too.
- Right after a Claude update (its cached exe is gone, or its version differs from the last self-check), if no
  card reads as signed in, every card that would turn **Not signed in** is treated as unknown; while the last
  self-check has failures, or while this start's self-check is still running, no card shows **Not signed in**.
- **Sign in again** replaces a card's folder only with a profile that reads as signed in. Otherwise the old folder
  stays as it was and the sign-in Claude opens again (Wait longer / Cancel). The old folder is set aside during the
  move and deleted only once the new session is in place.
- An unreadable or unparseable `config.json` counts as unreadable (unknown), not as "no account keys".
- `Claude.exe` comes from the package manifest (`app\Claude.exe` as the fallback); a renamed package is accepted when
  Anthropic publishes it and its manifest declares a `Claude.exe`. The "Running" indicator and closing accounts match
  the exe actually found, with the usual path as the fallback.

### Added

- **I'm signed in** in the sign-in dialog after "No sign-in found yet": finishes the sign-in without the automatic
  signal, after the same wait for Claude to save it.
- Self-check after a Claude update (and on every start while it fails): `Claude.exe`, the main profile, the process
  query, the account key names (skipped for a main profile that was never signed in) and the cookie table columns
  (skipped while every profile runs; a skipped check keeps its last result). The result is in the log and in
  **Copy diagnostics**; a calm notice appears only when a check fails that did not fail last time.
- **Copy diagnostics** shows the self-check result, unknown card states and an unsure detection.
- Tests run the parsers against the stored fixtures of every Claude version (`test/fixtures/claude-<version>/`) and
  check that no behaviour depends on Claude's version string. New fixtures for Claude 5.1231.0.0.

## [1.0.0] - 2026-11-07

First stable release. The code is the same as 0.7.0; this release changes only the documentation and the CI.

### Summary of v1

- One card per Claude account; a click opens that account in its own isolated Claude window
  (`--user-data-dir`), side by side with the others, with a **● Running** indicator.
- **Add account** signs in an extra account (e-mail or Google) in a blank Claude window and puts the main profile
  back afterwards; an interrupted sign-in is restored on the next start.
- Greeting with an editable name; **Rename**, **Edit details** (card name, e-mail, account name), **Change photo**,
  **Close this account** and **Remove** in the card ⋯ menu.
- **Receive memories from…**: a guided assistant to copy Claude's memories between accounts.
- Self-update from GitHub Releases (asks first; **Later** / **Install**).
- **Copy diagnostics** for bug reports, with nothing personal in it.
- MIT license.

### Changed

- README rewritten for v1: download, first install, updates, adding an account, limitations, credits.
- `docs/SCOPE.md` §7: done criteria marked with their results; scope changes since the plan recorded.
- CI no longer makes or uploads `badge-download.svg` (GitHub does not render images served from release assets;
  the README uses `docs/badges/download.svg`). The fixed-name `Claude-Launcher-Setup.exe` copy stays.

### Added

- `docs/IDEAS.md`: ideas for after v1.0.

## [0.7.0] - 2026-11-05

Review round and diagnostics: the last code changes before 1.0.

### Added

- **Copy diagnostics** link next to the version label: puts a plain-text report on the clipboard (launcher, Claude and
  Windows versions, the accounts by card label with signed-in / running, the cached paths written with
  `%LOCALAPPDATA%` / `%APPDATA%` / `%USERPROFILE%`, and the last 50 lines of `sign-in-timings.log`). E-mails, real
  names, the Windows and greeting names, the user folder and long token-like values are removed. The link says
  "Copied" for ~2 s.

### Changed

- Muted text is lighter (`--text-real-name` `#a3a19a`) and the dimmed "next" sign-in steps lose their extra opacity:
  4.5:1 (WCAG AA) on the window, the cards and the dialogs. Red error text, red menu items and links inside dialogs
  use slightly lighter shades for the same reason (buttons keep their colours).
- When a dialog closes, the focus goes back to what opened it (the card's ⋯ button, even after the cards are drawn
  again); every dialog is named by its title; the rename field and the memories box have labels.

### Fixed

- The window can no longer navigate away from the launcher page or open a new window (defence in depth: links
  already go through the browser with URLs built in the main process).

### Removed

- Dead code: `isSignedIn` / `hasOauth` (the `oauth:` keys stopped deciding in 0.4.5) and an unused memories string.

## [0.6.2] - 2026-11-04

Update polish.

### Added

- **"Update to X"** link next to the version label (bottom-right) after **Later**: it reopens the same dialog
  (What's new / Later / Install) and exists only while a newer version is known. During a sign-in or the memory
  assistant it shows the "busy" message.
- The **version label** opens the release page of the installed version (URL built in the main process).
- **"Finishing the update…"**: a launcher started while the update installer still runs quits instead of opening the
  old version (electron-updater's pending update info, then a process running from that installer file).
- One **shared button style** (secondary, primary, danger, menu item, text link) based on the main-screen hover:
  pointer, subtle colour change in ~120 ms, darker while pressed, no hover when disabled, no transition with reduced
  motion. Every dialog and menu button uses it.

### Changed

- The update check starts as soon as the app is ready, in parallel with the first screen (still never blocking the
  cards). The last newer version found is kept in the config: the next start shows the notice at once and the check
  confirms or clears it.
- "Installing… the launcher opens again in about 20 seconds.", shown for ~2.5 s before the launcher closes. The
  install stays silent: with `oneClick: false` an update run still stops on the installer's Finish page.

## [0.6.1] - 2026-11-04

Self-update test release: update download log; no functional changes.

### Added

- `sign-in-timings.log` gets one line per update download: version, size in bytes, time in ms and whether it was a
  **full** or a **differential** download (or **cached**, when the installer was already downloaded). No URLs or
  tokens are logged.

## [0.6.0] - 2026-11-04

Phase 5.2: the launcher updates itself.

### Added

- **Self-update** (`electron-updater`, GitHub Releases): once per start, after the cards are shown, the launcher
  checks for a newer release. If there is one: "Version X is available. Install now?" with **What's new** (opens the
  release page), **Later** (asked again on the next start) and **Install** (download with a progress bar, then a
  silent install and the launcher opens again). A failed download shows a short message with a link to the
  Releases page; nothing is ever forced. Never checks or installs during a sign-in or a memory import.
- Releases also carry `latest.yml` and the installer's `.blockmap` (used by the self-update).
- `scripts/install-latest.ps1` for testers, documented in the README.

### Changed

- Self-update moved from "Out of v1" into the scope (`docs/SCOPE.md` §5–§6).

## [0.5.1] - 2026-11-04

Phase 5.1: receive memories from another account, plus a faster first screen.

### Added

- **Receive memories from…** in the card ⋯ menu: pick another signed-in account, read the warning (memories are
  added, may duplicate or conflict, import is experimental, check your organization's rules for work accounts),
  then two guided steps: the launcher opens the source account, where you export the memories (Settings → Memory →
  Export memory → Export) and drop or choose the downloaded `.zip` (pasting the text or a `.txt` / `.md` file also
  works); then it opens the target account with the text on the clipboard (Settings → Memory → Start import →
  paste → confirm; **Copy again**, **Done**).
- The exported `.zip` is read in memory only (never extracted to disk, never logged): only its `.md` entries. Paths
  with `..` are ignored; more than 500 entries or more than 2 MB of real inflated text is refused.
- After a `.zip` is read, a checklist of its files grouped by folder (without the `claude-memory-<date>/` folder),
  with each file's size in characters and a running total. Files under `projects/` (Project memories) start
  unchecked; the text box previews the checked files, one heading per file.
- Over 100,000 characters, step 2 imports the text in parts of whole files ("Part 1 of N", **Copy part**,
  **Next part**), one Start import each. A file is never cut: one that alone is over the limit gets a message. Pasted
  text over the limit is reported with its length, never cut.
  The launcher never reads Claude's memories itself; the text is kept only in memory, never written to disk or to a
  log, and is cleared (and taken off the clipboard if it is still there) on Done, Cancel or when the window closes.

### Changed

- The Windows display name and the main Claude profile folder are kept in the launcher config: the first screen
  uses them at once instead of waiting for two PowerShell queries (~0.5 s), and they are looked up again in the
  background after the cards are shown (the greeting and Add account update if they changed). A sign-in still
  looks up the main profile fresh.

## [0.5.0] - 2026-11-04

Phase 5: account details and photo, plus housekeeping.

### Added

- **Add account** asks for the account's e-mail (required) and real name (optional) besides the card name; they
  show on the card. **Edit details** in the ⋯ menu changes them on any card, Main included. The launcher does not
  read them from Claude (local files were not a reliable source; `docs/WINDOWS.md` §5).
- **Change photo** in the ⋯ menu: pick a PNG, JPG or WebP image; the centre square is kept, scaled to 256 × 256 and
  shown as a circle (`userData/photos/<id>.png`). **Back to the initial** removes it.
- Startup time in `sign-in-timings.log` (`startup: cards shown: … ms …`, with the time of each step).
- `scripts/diagnose-accounts.ps1`: read-only report of where a Claude profile keeps account details (key names,
  paths and masked e-mails only).

### Changed

- The cards show the last known signed-in state (saved in the config) at once; the cookie checks run in the
  background after the cards are on screen and update them.
- After a sign-in, the main Claude is reopened only if it had a visible window before the sign-in started (not when
  it was running hidden or not running).
- "Not signed in" moved to the card's status line (the e-mail line now always shows the e-mail). Cards are 16 px
  taller.
- Node 24 (workflow and `engines`); `scripts/*.mjs` are now TypeScript run directly by Node and type-checked.
- Release tags and titles are `v<version>` (e.g. `v0.5.0`); older `launcher-v*` tags stay.

## [0.4.5] - 2026-10-28

Phase 4.4: the card check after a sign-out inside Claude (0.4.4 showed the card as signed in).

### Fixed

- The `config.json` `oauth:tokenCache` keys no longer decide whether a card is signed in (they stay after a
  sign-out). Only a valid claude.ai `sessionKey` cookie does. When the cookie database cannot be read, the card
  keeps its last known state and shows **Checking…**.
- Right after **Close this account** (and whenever an account stops running), the cookie database can stay locked
  for a few seconds: it is read again every ~1 s for up to ~10 s, then the card updates by itself.
- A `sessionKey` cookie that is expired (`expires_utc` in the past) or empty (value length 0, checked by length only)
  no longer counts as signed in.
- Cards are drawn again when an account starts or stops running (before, "Not signed in" only changed when the
  launcher was reopened).
- Sign-in on Claude 4.4212 (and later) is detected again, automatically and with **I've signed in**. Claude 4.x no
  longer writes the `oauth:tokenCache` keys the launcher waited for. The signal is now version-tolerant: a new
  account-related `config.json` key name (`oauth:*`, `lastKnownAccountUuid`, or a name containing `Account`) that
  was not there when the sign-in window opened. Values are never read. The cookie-write wait before the force-end
  stays.
- Sign-in safety (code review): the default profile folder must look like a Claude profile
  (`Claude-Data\claude_*` or `LocalCache\Roaming\Claude`, trailing `\` dropped) before anything is stashed, so the
  crash-recovery marker can always be read back. If the marker cannot be written, nothing is moved and the main
  Claude is opened again. A failed save of the new card no longer leaves the sign-in dialog on "saving".
- **Sign in** no longer says "Claude is not installed" when Claude is installed. Starting PowerShell took more than the
  5 s timeout on a busy PC. The launcher now remembers the `Claude.exe` path (and its PackageFamilyName) in its config
  and only checks that the file exists, so most clicks start no PowerShell at all. It looks Claude up again only when
  the file is gone (Claude updated) or nothing is remembered yet, with a ~15 s timeout and one retry. A lookup that does
  not finish shows "Couldn't find Claude in time. Try again."; "Claude is not installed" appears only when the lookup
  finished and found no Claude.
- Texts no longer mention a tray icon: Claude has none on Windows here. When its window closes it keeps running with
  no icon, and only Task Manager or **Close this account** ends it.

### Added

- `sign-in-timings.log` records the Claude version at the start of each sign-in (`start: Claude version: …`, from
  the exe path) and which key name detected it (`detect: new account key: …`).
- `sign-in-timings.log` records each final card decision per account (no cookie data): `card check <id>: cookie
  found | cookie not found | cookie expired | cookie empty | cookie DB unreadable (<reason>) for ~10 s -> kept: …`.
- A card shows **Running · Not signed in** when it runs and its last known state is signed out.

### Notes

- A sign-out inside Claude is only detected after the account is closed: Claude locks its cookie database while it
  runs (every copy fails with `EBUSY`, PC test). An earlier build of this PR re-checked running accounts every ~30 s;
  that was removed.
- The temporary cookie copy includes `Cookies-journal` / `Cookies-wal` (already the case since 0.4.2); now covered
  by a test.

## [0.4.4] - 2026-10-28

Phase 4.3: speed fixes after testing 0.4.3 on a real PC (0.4.3 was not released on its own: its changes ship here).

### Changed

- **Add account** / **Sign in** close the main Claude in ~1 s instead of ~5 s: a close request never works (Claude
  only hides in the tray), so after ~1 s only the default-profile processes are force-ended; the closing step gives up
  after ~10 s in all.
- If Claude is opened again while the launcher is closing it, the sign-in stops at once with "Claude was opened
  again. Close it and try again." Nothing is moved and the reopened Claude is left alone (before, the launcher kept
  trying for ~47 s).
- Finishing a sign-in waits for the real cookie write instead of a fixed time. Once the `oauth:tokenCache` keys are
  in `config.json`, the launcher waits until `Network\Cookies` (or its `-journal` / `-wal`) changes on disk (newer
  date or another size; the file is never opened while Claude runs), checked every ~500 ms for up to ~45 s. It then
  waits ~1 s more and force-ends the sign-in Claude. Chromium commits cookies about every 30 s, and the sign-in
  needs that write: earlier builds of this PR that ended Claude sooner (after ~2 s, or once the folder was quiet
  for ~5 s) opened the new account on the sign-in screen.
- If no cookie write comes within ~45 s, nothing is moved: the dialog says **"The sign-in was not saved yet"** with
  **Wait longer** (another ~45 s) and **Cancel** (puts the main profile back, as before).
- `sign-in-timings.log` records `finish: wait for the cookie write: written|cap: N ms`.
- A card counts as signed in only with the claude.ai `sessionKey` cookie, as in 0.4.2 (read from a temporary copy
  while the profile is closed). The `oauth:tokenCache` keys count only when the cookie database cannot be read.
- The version label moved to the bottom-right corner.

### Added

- Hovering the version label shows where the log is (`Logs: %APPDATA%\claude-launcher\sign-in-timings.log`).
- Claude's window is brought to the front when the launcher opens an account or the sign-in window (best effort:
  if Windows refuses, nothing fails).

## [0.4.3] - 2026-10-27

Phase 4.2: sign-in speed and small UI follow-ups after testing 0.4.2 on a real PC.

### Changed

- **Add account** / **Sign in** no longer look frozen: the dialog opens at once with live steps ("Closing Claude…",
  "Preparing a clean profile…", "Opening sign-in window…"). Claude is first asked to close and its exit is checked
  every ~250 ms; after ~5 s only the default-profile processes are force-ended. The two lookups before it (main
  profile and `Claude.exe`) now run in parallel.
- Sign-in detection is much faster: the signal is now the `oauth:tokenCache` / `oauth:tokenCacheV2` key names
  appearing in `config.json` (checked every ~1 s; values are never read or logged), instead of waiting for Claude's
  lazy cookie write. The sign-in Claude is then closed gracefully so it writes its cookies, and nothing moves unless
  the `sessionKey` cookie is on disk, as before. If Claude only hides to the tray, the launcher waits for the cookie
  (up to ~35 s) before force-ending it. **I've signed in** uses the same logic.

### Added

- A small fixed **Main** badge on the Main card; it stays when the card is renamed.
- The launcher's version (e.g. `v0.4.3`) in the bottom-left corner.
- `sign-in-timings.log` in the launcher's data folder: how long each sign-in step took (paths and durations only).

### Documentation

- `SCOPE.md`: **Close this account** keeps the launcher open; "Running" means the Claude process is open; a
  signed-out account is only known once its profile is closed.
- `PHASES.md`: Phase 5.1 — Receive memories from… (guided assistant).

## [0.4.2] - 2026-10-27

Phase 4.1: fixes and account controls after testing 0.4.1 on a real PC.

### Fixed

- After a successful sign-in only the main Claude reopened and the new account's window stayed closed. Now the main
  Claude is put back and the new account opens too, so you land in it. (Present in 0.4.0 and 0.4.1.)
- The first open of a freshly signed-in account could start Claude in the tray with no window while the launcher
  closed, so a second click was needed. The launcher now waits (up to ~8 s) for that profile's window, opens it once
  more after ~3 s without one, and closes only when the window is visible; otherwise it stays open and says so.
  (Present in 0.4.0 and 0.4.1.)
- "Not signed in" did not show after signing out inside an account: the `config.json` keys stay after a sign-out.
  The signal is now the claude.ai `sessionKey` cookie row in `<profile>\Network\Cookies`, read from a temporary copy
  (cookie names and hosts only; values are never read; the copy is deleted). A running account keeps its last known
  state; `config.json` is only a fallback when the cookie database cannot be read. Uses Node's built-in
  `node:sqlite` (no new dependency). (Present in 0.4.0 and 0.4.1.)
- **Add account** closes only the main (default profile) Claude; extra accounts stay open. Covered by tests now.
- Sign-in: **Cancel** pressed while the sign-in was already finishing could put the main profile back and then move
  it into the new account's folder. Cancel is now ignored while finishing, and the "I've signed in" countdown no
  longer reappears (re-enabling Cancel) once finishing has started. (Found in the 0.4.2 review.)

### Added

- Card ⋯ menu: **Close this account**, enabled only while that account runs. It ends only that profile's Claude
  (closing the window only hides it in the tray).
- **Remove** on a running account asks "Cancel" / "Close and remove".

### Changed

- **I've signed in** checks at once and continues if the session is saved; otherwise it shows "Checking… (N s)"
  for ~15 s with Cancel available, then "No sign-in found…". It never moves or restores anything by itself (before,
  it waited up to 40 s and then put the main profile back).

## [0.4.1] - 2026-10-26

Fix of the Phase 4 sign-in after the first test on a real PC (Claude 3.6556.2.0).

### Fixed

- The default Claude profile is `%LOCALAPPDATA%\Claude-Data\claude_<id>`, not the MSIX
  `LocalCache\Roaming\Claude` folder (empty on that version). It is now found on every sign-in: from the
  `--user-data-dir` of the running default Claude's child processes, else `Claude-Data\<PackageFamilyName lowercased>`,
  else any `Claude-Data\claude_*` folder, else the old MSIX path; a folder counts only if it holds `Network\Cookies`
  (or `Cookies`). Nothing is hard-coded.
- Sign-in detection and the saved-session check look at `<profile>\Network\Cookies` (and its `-journal`/`-wal`).

### Added

- The sign-in stops before touching anything if a program runs from inside the profile folder (for example the
  Claude Code CLI under `claude-code\…`): "Your Claude folder is in use".
- Fail-safe: when no profile folder can be trusted, **Add account** and **Sign in** are turned off with a message
  (opening accounts keeps working) and `sign-in-check.log` in the launcher's data folder lists the folders checked
  (paths and yes/no only).

## [0.4.0] - 2026-10-26

Phase 4: signing in extra accounts from the launcher (snapshot flow, `docs/WINDOWS.md` §4).

### Added

- **Add account** now signs in: after naming the card and confirming, the launcher closes the main Claude, writes a
  marker (`%LOCALAPPDATA%\ClaudeLauncher\login-pending.json`), sets the default profile aside by renaming it to
  `Claude.launcher-stash`, opens a blank Claude, waits for the sign-in, moves the signed-in folder to
  `%USERPROFILE%\ClaudeProfiles\<id>`, renames the stash back and reopens the main Claude if it was open.
- Automatic sign-in detection (OAuth token in `config.json` plus a cookie-store write after it, like
  ai-multi-instance), with an **I've signed in** button as fallback and **Cancel** at any point. A session without
  the `sessionKey` cookie is never kept.
- **Sign in** on cards that exist but are not signed in yet (created in 0.3.0): click the card or use the ⋯ menu; the
  flow replaces that card's folder instead of creating a new card. Such cards show "Not signed in".
- Recovery on startup, before anything else: if a marker is found, choose **Restore main profile** (default) or
  **Continue sign-in**; a sign-in interrupted after the move is completed automatically.
- Safety checks: at least 500 MB free, the default Claude must be closed (otherwise nothing is touched), an existing
  stash is never overwritten, the stash is only renamed back (never deleted) and a failed restore shows its exact path.
  Closing the launcher during a sign-in cancels it cleanly.
- Tests on real temporary folders (Linux and the `windows-latest` job): success, existing card, no main profile,
  cancel, manual confirm without a saved session, live default instance (abort), low disk, existing stash, crashes at
  three different moments, and a failing process query.

### Changed

- Docs: README explains the sign-in flow and the manual backup; Phase 4 plan includes the **Sign in** action.

## [0.3.0] - 2026-10-26

Phase 3: the first usable version. Cards open Claude; signing in extra accounts from the launcher arrives in 0.4.0.

### Added

- Clicking a card opens Claude for that account: Main without flag, other accounts with
  `--user-data-dir=%USERPROFILE%\ClaudeProfiles\<id>`. `Claude.exe` is resolved on every launch with `Get-AppxPackage`
  (fallback: old install in `%LOCALAPPDATA%\AnthropicClaude`). The launcher closes by itself afterwards.
  If Claude is not installed, a clear message is shown.
- "Running" indicator on the cards, from the Claude Desktop process list (filtered by exe path, so the Claude Code CLI
  and Chromium child processes are ignored), refreshed every ~3 s while the window is visible.
- **Add account** (temporary until the sign-in flow): asks for the card name, creates the card and its profile folder.
- Tests with mocked PowerShell output and a mocked `spawn` (process list with CLI and child processes, exe resolution,
  launch arguments, account ids and folder rules).

### Changed

- **Remove** also deletes the account's profile folder (only folders directly inside `ClaudeProfiles`). It is refused
  while that account's Claude is open.
- The first run starts with only the Main account; the Phase 2 sample accounts (`demo-work`, `demo-college`) are
  dropped from existing configs.
- Cards are smaller (160 × 200 at 100 % scale, avatar 64 px) with the content vertically centred; the greeting, cards
  and button are centred in the whole window.
- Releases are now regular releases marked as latest (0.1.0 and 0.2.0 were pre-releases).

## [0.2.0] - 2026-10-26

Phase 2: the real screen, with sample accounts. Opening accounts arrives in 0.3.0.

### Added

- Launcher screen: greeting by time of day with the Windows display name (first word, stray punctuation removed,
  `USERNAME` as fallback); hovering the name shows a pencil and the name can be edited (Enter or leaving the field
  saves, Esc cancels, empty restores the Windows name).
- Account cards in a single row with horizontal scrolling: initial avatar, card name, email and real name (cut with an
  ellipsis, full text in a tooltip), hover and keyboard focus. The Main card (default Claude profile) is always first.
- Card ⋯ menu: **Rename** and **Remove** (with confirmation; not on Main) save to the launcher config;
  **Change photo** is shown but not available yet. The **Add account** button is visual only.
- Launcher config `config.json` in the app's `userData` folder (`{ version, greetingName, accounts }`), written
  atomically; an unreadable file is kept aside as `config.json.corrupt-<time>`. The first run adds two sample
  accounts (`demo-*`) so the screen can be tried.
- Original icon (two four-point sparkles) for the app, the installer and the greeting; `npm run icon` regenerates
  `build/icon.ico` from `build/icon.svg`.
- Bundled OFL fonts (Source Serif 4 and Inter, variable) via `@fontsource-variable`; theme colours and sizes as CSS
  variables in one place; dark title bar (`titleBarOverlay`); window 900 × 600, minimum 720 × 480.
- Tests: display-name cleanup, config rules (Main first, rename, remove), config file read/write, Windows name with a
  mocked PowerShell.

### Changed

- Phase 1.6: the project now lives in its own repository, `histuan/Claude-Launcher`, at the repo root.
- CI: the workflow runs on every pull request and push to `main` (no path filters) from the repo root; artifact and
  npm cache paths updated. Release on merge unchanged.
- PR template moved to `.github/pull_request_template.md`, so GitHub pre-fills it.
- `CLAUDE.md`, `docs/PHASES.md`, `README.md` (badges and links) and `STATUS.md` point to the new repository.
- `STATUS.md` moved to `docs/STATUS.md`; references in `CLAUDE.md`, `docs/PHASES.md` (prompt template included) and
  `README.md` updated.

### Fixed

- Restored the CI workflow (`.github/workflows/claude-launcher.yml`), deleted by mistake after the 0.1.0 merge.

## [0.1.0] - 2026-10-26

First pre-release: the project skeleton (Phase 1) plus the GitHub process and English rename (Phase 1.5).

### Added

- Electron app with a placeholder window, `src/` layout, greeting rule with tests (`node:test`).
- Per-user NSIS installer (`Claude-Launcher-Setup-<version>.exe`) built by GitHub Actions on `windows-latest`.
- Automatic pre-release on merge to `main`: tag `launcher-v<version>` with the installer and the notes from this file.
- Pull request template, this changelog, and README badges and download section.

### Changed

- Renamed the project to **Multi-Account Launcher for Claude** (folder `claude-launcher`, app id
  `com.histuan.claude-launcher`).
- Interface and documentation translated to English; all interface texts live in `src/renderer/strings.ts`.
- Code and tests migrated to TypeScript (`strict`), compiled with `tsc` into `out/`; new `build` and `typecheck` scripts.
- CI: actions updated to v7 (Node 24); runs `typecheck` and tests before the build; runs on pull requests and on
  pushes to `main`.

[Unreleased]: https://github.com/histuan/Claude-Launcher/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/histuan/Claude-Launcher/compare/v0.7.0...v1.0.0
[0.7.0]: https://github.com/histuan/Claude-Launcher/compare/v0.6.2...v0.7.0
[0.6.2]: https://github.com/histuan/Claude-Launcher/compare/v0.6.1...v0.6.2
[0.6.1]: https://github.com/histuan/Claude-Launcher/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/histuan/Claude-Launcher/compare/v0.5.1...v0.6.0
[0.5.1]: https://github.com/histuan/Claude-Launcher/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/histuan/Claude-Launcher/compare/launcher-v0.4.5...v0.5.0
[0.4.5]: https://github.com/histuan/Claude-Launcher/compare/launcher-v0.4.4...launcher-v0.4.5
[0.4.4]: https://github.com/histuan/Claude-Launcher/compare/launcher-v0.4.2...launcher-v0.4.4
[0.4.3]: https://github.com/histuan/Claude-Launcher/compare/launcher-v0.4.2...launcher-v0.4.3
[0.4.2]: https://github.com/histuan/Claude-Launcher/compare/launcher-v0.4.1...launcher-v0.4.2
[0.4.1]: https://github.com/histuan/Claude-Launcher/compare/launcher-v0.4.0...launcher-v0.4.1
[0.4.0]: https://github.com/histuan/Claude-Launcher/compare/launcher-v0.3.0...launcher-v0.4.0
[0.3.0]: https://github.com/histuan/Claude-Launcher/compare/launcher-v0.2.0...launcher-v0.3.0
[0.2.0]: https://github.com/histuan/Claude-Launcher/compare/launcher-v0.1.0...launcher-v0.2.0
[0.1.0]: https://github.com/histuan/Claude-Launcher/releases/tag/launcher-v0.1.0
