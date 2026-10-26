# Multi-Account Launcher for Claude — instructions for Claude Code

Windows launcher (Electron) that opens the Claude desktop app in isolated profiles (`--user-data-dir`),
one account per profile, with no signing out and back in.

- Product scope: `docs/SCOPE.md`
- Verified Windows facts and sign-in design: `docs/WINDOWS.md`
- Phase plan (with the prompt for each phase): `docs/PHASES.md`
- Where we stopped: `STATUS.md`. History of changes: `CHANGELOG.md`

## Before anything else

1. Use the **dev-economico** skill (it comes from Thiago's account). If it is not available in this session, say so at the
   start of the report and work economically: read only what is needed, closed scope, test before calling it done.
2. Read `STATUS.md` and only the current phase's section in `docs/PHASES.md`. Read `SCOPE.md` and `WINDOWS.md` only in the sections the phase cites.
3. Work only in `claude-launcher/` and `.github/workflows/claude-launcher.yml`. This repository is a monorepo:
   never read or change the other folders (`lorax-space-invaders`, `web-development` etc.).
   Everything of the project lives in `claude-launcher/`. The only exception is the workflow: GitHub Actions only reads
   workflows from `.github/workflows/` at the repo root, so it must stay there (do not move it, do not delete `.github/`).

## Environment

- Usually you are in a **cloud session**: Linux, no display, no access to Thiago's PC.
- The `.exe` is built by **GitHub Actions** (`windows-latest`), never inside the session. Do not try Wine or Docker.
- Exception to dev-economico: here `STATUS.md` goes **into git**, because the cloud VM is deleted.
- In the cloud you do not need the Electron binary to test the logic: use `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci`
  (drop it only to try the offscreen screenshot).
- To check Actions, use `gh run list` / `gh run view` (REST API) or the GitHub MCP tools. If neither works, say so in
  the report and Thiago checks the Actions tab.
- Local Claude Code (on Thiago's PC) is the last resort: only when a bug shows up only on real Windows and logs are not enough.

## GitHub process

- Each phase works on the session branch and ends with a **Pull Request to `main`**. Never push directly to `main`.
- Commits follow *Conventional Commits* with the `launcher` scope: `feat(launcher): …`, `fix(launcher): …`,
  `docs(launcher): …`, `ci(launcher): …`. Commit messages in English.
- The PR description follows `docs/PR_TEMPLATE.md` (fill it in yourself; GitHub does not auto-load it from this folder)
  and includes `Closes #<phase issue>`
  (issues are titled `[launcher] Phase N — …`).
- Each phase bumps `version` in `package.json` to `0.N.0` (Phase 1.5 kept `0.1.0`) and adds its section to `CHANGELOG.md`
  (*Keep a Changelog*: move the `Unreleased` items into the new version section).
- On merge to `main`, the workflow creates the tag `launcher-v<version>` and a GitHub Release with the installer and the
  notes from `CHANGELOG.md` (pre-release while the version is `< 1.0.0`). The PR run uploads the installer as an artifact.
- Thiago tests and merges. The next phase starts only after the merge.

## Stack

- Electron + **TypeScript** (`strict`), compiled with `tsc`. Interface in HTML/CSS + TS, no framework.
  (Migrated from JS to TS in Phase 1.5.)
- Tests: `node:test` on the compiled output. Build: `electron-builder` (NSIS installer) packages `out/`.
- Free fonts (OFL) bundled via `@fontsource`. No CDN: the app works offline.
- New dependency: justify it in one line in the report.

## Commands (inside `claude-launcher/`)

- `npm ci` — install
- `npm run build` — compile `src/` and `test/` into `out/` (ignored by git) and copy the renderer's HTML/CSS
- `npm run typecheck` — type check only
- `npm test` — build, then run `out/test/**/*.test.js` with `node --test`
- `npm start` — build and open the app (does not work in the cloud, which has no display)

## Architecture

- `src/core/` — pure, testable logic (greeting, name, profile rules, sign-in state).
- `src/main/` — Electron main process. The preload is `preload.cts` (compiles to CommonJS, required by the sandbox).
- `src/main/system/` — the **only** place that touches Windows (PowerShell, processes, Claude folders).
  Everything injectable, so tests can use mocks.
- `src/renderer/` — interface. `preload` with `contextBridge`, `contextIsolation: true`, `nodeIntegration: false`.
- **All user-facing texts** live in `src/renderer/strings.ts` (English), so other languages can be added later.
  Never hard-code interface text elsewhere.
- Launcher configuration: JSON in `app.getPath('userData')`.

## Rules that must never be broken

1. Never copy, modify or move the Claude app (`WindowsApps`). Resolve `Claude.exe` on every launch via `Get-AppxPackage`.
2. The default Claude profile is touched only by the sign-in flow (`docs/WINDOWS.md`, section 4), with stash, marker and restore. No other code writes there.
3. Session cookies and tokens: never log them, never store them in plain text, never send them to any host other than `claude.ai`.
4. Detect Claude processes by the exe **path** (`\WindowsApps\Claude_*\app\Claude.exe`), never by name alone:
   the Claude Code CLI is also called `claude.exe`. Ignore processes with `--type=` (Chromium children).
5. Paths always through environment variables (`USERPROFILE`, `LOCALAPPDATA`), never `C:\Users\thiag`.
6. Do not use Claude's official logo or font. Original icon; free serif font.
7. Open Claude with `spawn` detached, `stdio: 'ignore'`, `windowsHide: true`, and `unref()`.

## Verification

- Logic: `node:test` tests with mocks of `src/main/system/`. Run `npm run typecheck` and `npm test` before calling it done.
- Interface: if possible, a screenshot via offscreen Electron (`xvfb-run`). If not possible in the cloud, say so and leave it to Thiago.
- The real test is on Thiago's PC: at the end of the phase, write a short "How to test" in `STATUS.md`
  (download the installer from the Releases page or the PR artifact, install, what to check).
- If something in the phase is impossible in the cloud, stop and explain instead of improvising.

## Habits to avoid

- (empty for now; add here whatever Thiago corrects)
