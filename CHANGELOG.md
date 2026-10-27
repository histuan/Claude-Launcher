# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Releases are tagged `launcher-vX.Y.Z`.

## [Unreleased]

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

[Unreleased]: https://github.com/histuan/Claude-Launcher/compare/launcher-v0.4.2...HEAD
[0.4.2]: https://github.com/histuan/Claude-Launcher/compare/launcher-v0.4.1...launcher-v0.4.2
[0.4.1]: https://github.com/histuan/Claude-Launcher/compare/launcher-v0.4.0...launcher-v0.4.1
[0.4.0]: https://github.com/histuan/Claude-Launcher/compare/launcher-v0.3.0...launcher-v0.4.0
[0.3.0]: https://github.com/histuan/Claude-Launcher/compare/launcher-v0.2.0...launcher-v0.3.0
[0.2.0]: https://github.com/histuan/Claude-Launcher/compare/launcher-v0.1.0...launcher-v0.2.0
[0.1.0]: https://github.com/histuan/Claude-Launcher/releases/tag/launcher-v0.1.0
