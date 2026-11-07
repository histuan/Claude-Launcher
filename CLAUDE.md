# Multi-Account Launcher for Claude — instructions for Claude Code

Windows launcher (Electron) that opens the Claude desktop app in isolated profiles (`--user-data-dir`),
one account per profile, with no signing out and back in.

- Product scope: `docs/SCOPE.md`
- Verified Windows facts and sign-in design: `docs/WINDOWS.md`
- Phase plan (with the prompt for each phase): `docs/PHASES.md`
- Where we stopped: `docs/STATUS.md`. History of changes: `CHANGELOG.md`

## Before anything else

1. Use the **dev-economico** skill. If it is not available in this session, say so at the
   start of the report and work economically: read only what is needed, closed scope, test before calling it done.
2. Read `docs/STATUS.md` and only the current phase's section in `docs/PHASES.md`. Read `SCOPE.md` and `WINDOWS.md` only in the sections the phase cites.
3. The repository is `histuan/Claude-Launcher` and the project lives at its root. Do not read `node_modules/`, `out/`
   or `dist/`.

## Environment

- You run as **local Claude Code on my PC**: Windows 11, Node 24, `gh` CLI. The repo is at
  `C:\codiguinhos\Github\Claude-Launcher`. The real app can be built and started here (`npm start`).
- **Safety:** never run the sign-in flow, "Close this account", or anything that touches the default Claude profile or
  `%USERPROFILE%\ClaudeProfiles` without asking me first. Prefer tests with mocks.
- The `.exe` is built by **GitHub Actions** (`windows-latest`), never inside the session.
- Exception to dev-economico: here `docs/STATUS.md` goes **into git**, so the context lives in the repository.
- To check Actions, use `gh run list` / `gh run view` (REST API) or the GitHub MCP tools. If neither works, say so in
  the report and i check the Actions tab.

## GitHub process

- Phases, code, CI and version changes work on a branch and end with a **Pull Request to `main`**.
- Small docs-only changes (README, docs, typos, CLAUDE.md) go straight to `main`, without a PR.
- Commits follow *Conventional Commits* with the `launcher` scope: `feat(launcher): …`, `fix(launcher): …`,
  `docs(launcher): …`, `ci(launcher): …`. Commit messages in English.
- The PR description follows `.github/pull_request_template.md` (GitHub pre-fills it in the web UI; when opening the
  PR through a tool, fill it in yourself) and includes `Closes #<phase issue>`
  (issues are titled `[launcher] Phase N — …`).
- Each phase bumps `version` in `package.json` to `0.N.0` (Phases 1.5 and 1.6 kept `0.1.0`) and adds its section to `CHANGELOG.md`
  (*Keep a Changelog*: move the `Unreleased` items into the new version section).
- On merge to `main`, the workflow creates the tag `v<version>` (since 0.5.0; older ones are `launcher-v<version>`)
  and a GitHub Release titled `v<version>` with the installer and the
  notes from `CHANGELOG.md`, published as a regular release marked as latest (0.1.0 and 0.2.0 were pre-releases). The PR run uploads the installer as an artifact.
- I test and merge. The next phase starts only after the merge.

## Stack

- Electron + **TypeScript** (`strict`), compiled with `tsc`. Interface in HTML/CSS + TS, no framework.
  (Migrated from JS to TS in Phase 1.5.)
- Tests: `node:test` on the compiled output. Build: `electron-builder` (NSIS installer) packages `out/`.
- Free fonts (OFL) bundled via `@fontsource`. No CDN: the app works offline.
- New dependency: justify it in one line in the report.

## Commands (at the repo root)

- `npm ci` — install
- `npm run build` — compile `src/` and `test/` into `out/` (ignored by git) and copy the renderer's HTML/CSS
- `npm run typecheck` — type check only
- `npm test` — build, then run `out/test/**/*.test.js` with `node --test`
- `npm start` — build and open the app

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

1. Never copy, modify or move the Claude app (`WindowsApps`). The resolved `Claude.exe` path is cached in the launcher
   config and used only while the file exists; when it is missing (Claude updated) or not cached, resolve it again via `Get-AppxPackage`.
2. The default Claude profile is touched only by the sign-in flow (`docs/WINDOWS.md`, section 4), with stash, marker and restore. No other code writes there.
3. Session cookies and tokens: never log them, never store them in plain text, never send them to any host other than `claude.ai`.
4. Detect Claude processes by the exe **path** (`\WindowsApps\Claude_*\app\Claude.exe`), never by name alone:
   the Claude Code CLI is also called `claude.exe`. Ignore processes with `--type=` (Chromium children).
5. Paths always through environment variables (`USERPROFILE`, `LOCALAPPDATA`), never `C:\Users\thiag`.
6. Do not use Claude's official logo or font. Original icon; free serif font.
7. Open Claude with `spawn` detached, `stdio: 'ignore'`, `windowsHide: true`, and `unref()`.

## Verification

- Logic: `node:test` tests with mocks of `src/main/system/`. Run `npm run typecheck` and `npm test` before calling it done.
- The real test is on my PC: at the end of the phase, write a short "How to test" in `docs/STATUS.md`
  (download the installer from the Releases page or the PR artifact, install, what to check).

## Agent skills

### Issue tracker

GitHub Issues of `histuan/Claude-Launcher`. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the root (created when needed). See `docs/agents/domain.md`.

## Habits to avoid

   - Public texts (PR titles and descriptions, commit messages, issues, release notes, CHANGELOG, README) never
     name the maintainer or say who asked for, decided or tested something ("Thiago wants…", "approved by Thiago",
     "on Thiago's PC"). State the change, the reason and the result directly: "tested on Windows 11", "the old badges
     were small", "scope change: self-update". The only name in public texts is the copyright line of the license.
   - Always use generic names on examples. EX: John Doe, JohnDoe@email.com etc. 
