# Status

**Current phase:** 4.3 — Speed fixes (0.4.4), in PR #14 (same branch; it also carries the unmerged 0.4.3), waiting
for Thiago's test and merge. 0.4.3 tested on the PC: Main badge and version label OK, detection much faster.
Next: Phase 5 — Account details and photo (issue #2), then Phase 5.1 — Receive memories from… (`docs/PHASES.md`).

## Done

- Full planning (`docs/SCOPE.md`, `docs/WINDOWS.md`, `docs/PHASES.md`).
- Phase 0 on Thiago's PC (2026-10-26): isolated profile with `--user-data-dir` works on Claude 3.6556.2.0.
- Phase 1 (2026-10-26): `package.json` (Electron 44, electron-builder 26, per-user NSIS), `src/` layout, window with
  placeholder text, `src/core/greeting.js` + test, workflow building the `.exe` on Windows.
- Phase 1.5 (2026-10-26): renamed to **Multi-Account Launcher for Claude**, docs and interface in
  English (texts in `src/renderer/strings.ts`), PR flow in `CLAUDE.md`, PR template, `CHANGELOG.md`, automatic
  pre-release on merge to `main`, actions at v7, one issue per phase, README badges and Download section,
  code migrated to TypeScript (`strict`, TypeScript 7, output in `out/`).
- Phase 1.6 (2026-10-26): standalone repository `histuan/Claude-Launcher`, project at the root; workflow without path
  filters; PR template at `.github/pull_request_template.md`.
- Phase 2 (2026-10-26, version 0.2.0): real screen with sample accounts (greeting with editable name, cards, ⋯ menu,
  Add button), launcher config in `userData`, original icon (`build/icon.svg` → `build/icon.ico`), bundled fonts,
  theme variables in `src/renderer/styles.css`. Screenshot: `docs/screenshots/phase-2.png`.
- Phase 3 (2026-10-26, version 0.3.0): cards open Claude (Main without flag, others with `--user-data-dir`), the
  launcher closes afterwards; "Running" indicator (process query every ~3 s while visible); **Add account** creates the
  card and its profile folder (no sign-in yet); **Remove** deletes the profile folder (refused while that account runs);
  `demo-*` accounts dropped; releases are now regular "latest" releases. Review fixes: cards 160 × 200 with centred
  content, whole group centred in the window. Screenshot (mocked data): `docs/screenshots/phase-3.png`.

- Phase 4 (2026-10-26, version 0.4.0): sign-in by snapshot (`docs/WINDOWS.md` §4) in `src/main/signInFlow.ts` (the only
  code that writes to the default profile) and `src/core/signIn.ts`: marker, stash by rename, automatic detection +
  "I've signed in" + Cancel, move to `ClaudeProfiles\<id>`, restore, recovery dialog on startup. **Add account** uses
  it; signed-out cards get **Sign in**. Screenshot (mocked): `docs/screenshots/phase-4.png`.
- Phase 4 fix (0.4.1): the PC test showed the default profile is `%LOCALAPPDATA%\Claude-Data\claude_<id>`, not the
  MSIX LocalCache (empty). Resolution order and fail-safe in `docs/WINDOWS.md` §2; abort when something runs from the
  profile folder (Claude Code CLI); `sign-in-check.log` with the folders checked.

- Phase 4.1 (0.4.2): after a sign-in the new account opens too; opening waits for a visible window (spawns once more
  after ~3 s, launcher stays open if none after ~8 s); "Not signed in" from the claude.ai `sessionKey` cookie row
  (`node:sqlite` on a temp copy); **Close this account** in the ⋯ menu; **Close and remove**; **I've signed in** is a
  read-only check with a 15 s countdown. Add account closes only the default instance (tested).

- Phase 4.2 (0.4.3): the sign-in dialog opens at once with live steps; Claude is asked to close (exit polled every
  ~250 ms with a signal-0 check, no PowerShell) and only the default-profile processes are force-ended after ~5 s;
  detection = `oauth:tokenCache*` key names in `config.json` (every ~1 s) → graceful close → `sessionKey` cookie check;
  step timings in `sign-in-timings.log`; fixed "Main" badge; version label bottom-left. Screenshots (mocked):
  `docs/screenshots/phase-4.2-cards.png`, `docs/screenshots/phase-4.2-steps.png`.

- Phase 4.3 (0.4.4): closing the main Claude = close request for ~1 s, then force-end of the default profile only
  (~10 s in all); a NEW default-profile process meanwhile stops the start with "Claude was opened again" (nothing
  stashed); finishing = keys seen → ~2 s settle → force-end → move (no cookie wait, no "not saved" dialog); a card is
  signed in with the cookie OR the keys; Claude's window brought to the front (best effort); version label bottom-right.

## Missing

- Phases 5 and 6 (`docs/PHASES.md`).
- Milestone "Multi-Account Launcher v1.0": the cloud session has no tool to create milestones. Thiago creates it on
  GitHub (Issues → Milestones → New milestone) and adds the open phase issues (#1–#5) to it.

## Notes for Phase 5

- Email and real name are not detected yet: new cards show only their name (SCOPE §4.2.4, `docs/WINDOWS.md` §5).
  The signed-in profile is `account.profileDir`; `src/main/system/claudeProfile.ts` already reads its `config.json`.
- `config.json` holds `oauth:tokenCache`, `oauth:tokenCacheV2` and `lastKnownAccountUuid` (seen in the 0.4.1 test).
  `lastKnownAccountUuid` may identify the account without secrets: try it first (`docs/WINDOWS.md` §5).
- Not verified on the PC yet: the window query (`Get-Process` `MainWindowHandle` joined to `Win32_Process` by id) and
  the cookie reader on a real Chromium `Cookies` file. If "Not signed in" looks wrong, the reader may have failed and
  fallen back to `config.json` (a warning goes to the console).
- `launchClaude` uses `windowsHide: true` (CLAUDE.md rule 7). libuv also applies it to GUI windows (`SW_HIDE` in
  `STARTUPINFO`); if Claude's window does not appear when opened from the launcher, this is the first suspect.
- Old (non-MSIX) install: it opens, but the "Running" indicator and sign-in only support the MSIX package
  (without a trusted profile folder, sign-in is turned off: "Sign-in is turned off" + `sign-in-check.log`).
- The greeting still waits for the PowerShell name query (timeout 5 s). If it feels slow, cache the name in the config.

## Decisions

- Electron + TypeScript; `.exe` only through GitHub Actions; one PR per phase, release on merge.
- Own repository (`histuan/Claude-Launcher`), project at the root. The PR template is `.github/pull_request_template.md`.
- Extra accounts sign in by snapshot of the default profile, with stash and restore.
- Email and name detected automatically with manual fallback; photo chosen by the person, initial by default.
- Original icon and free serif font (no logo and no official Claude font).
- Dark theme only in v1; the launcher closes by itself after opening an account.
- TypeScript with plain `tsc` (no bundler); a small `scripts/copy-assets.mjs` copies the renderer's HTML/CSS into `out/`.
- `src/core` returns language-neutral keys (e.g. `greetingFor()` → `'morning'`); texts come from `strings.ts`.
- Config: Main is the account with `profileDir: null`, always first, never removed; its `label` is `null` until renamed
  (shows `strings.mainAccount`). Other accounts: `profileDir` = `%USERPROFILE%\ClaudeProfiles\<id>` (from the env var).
  Names are trimmed and capped at 40 characters. An unreadable config is renamed to `config.json.corrupt-<time>`.
- Greeting name: Enter **or leaving the field** saves, Esc cancels, empty restores the Windows name.
- Fonts: `@fontsource-variable/source-serif-4` and `@fontsource-variable/inter` (variable weight), copied with their
  OFL licenses into `out/` by `scripts/copy-assets.mjs`.
- Icon: `npm run icon` renders `build/icon.svg` with Playwright (not a project dependency) into `build/icon.ico`.
- Profile ids come from the card name (ASCII slug, e.g. "Trabalho Ágil" → `trabalho-agil`), unique, never a Windows
  device name nor a folder that already exists; the folder name is the id. The launcher only creates or deletes folders
  directly inside `%USERPROFILE%\ClaudeProfiles` (`isLauncherProfileDir`).
- Process filtering by exe path is done in `src/core/processes.ts` (tested); PowerShell only lists `claude.exe`.
- Card size: CSS px already follow Windows scaling, so sizes are set for 100 % (160 × 200 shows as 240 × 300 at 150 %).
- Releases: regular and marked as latest since 0.3.0.
- Sign-in (0.4.4): the default Claude is asked to close (`taskkill /PID <pid> /T`, no `/F`), its exit is checked every
  ~250 ms (`process.kill(pid, 0)`), and after ~1 s what is left of the default profile is force-ended
  (`taskkill /T /F`, as ai-multi-instance does); a default-profile pid that was not there at the start = "reopened",
  stop at once and never end it. Finishing: ~2 s after the keys appear, the sign-in Claude is force-ended (the close
  request never works; the desktop sign-in lives in `config.json`, so no cookie wait). A failed
  process query counts as "still running" (abort), never as "closed". The main Claude is reopened at the end only if it
  was open before (cancel and success alike); after a success the new account opens too.
  "Session saved" (inside the sign-in, blank profile) = the text `sessionKey` in the cookie database files.
- "Signed in" for a card (0.4.4) = a claude.ai `sessionKey` row in `<profile>\Network\Cookies` (queried with the
  built-in `node:sqlite` on a temporary copy; names and hosts only, never values; copy deleted) **or** the
  `oauth:tokenCache*` key names in `config.json`. A running account keeps its last known state. Known trade-off: the
  keys stay after a sign-out inside Claude, so that card keeps looking signed in. A plain cookie text search is not
  enough: SQLite keeps a deleted row's text in free pages after a sign-out.
- Opening an account waits up to ~8 s for that profile's visible window (spawns once more after ~3 s); the launcher
  closes only then. "Close this account" / "Close and remove" end only that profile's main processes
  (`taskkill /T /F`): Main = no `--user-data-dir`, extra = its own `--user-data-dir`.
  Minimum free space 500 MB on the drive of the default profile. The Add card is created only when the sign-in succeeds.

## How to test

Phase 4.3 (0.4.4). Sign-in still moves your main Claude profile for a moment: keep a backup of
`%LOCALAPPDATA%\Claude-Data\claude_…` (copied elsewhere with Claude fully closed).

0. Get `Claude-Launcher-Setup-0.4.4.exe`: before the merge, from PR #14's latest Actions run (artifact
   **launcher-installer**); after the merge, from the **Releases** page (tag `launcher-v0.4.4`). Install over 0.4.3.
1. **(d) Version:** the bottom-**right** corner says **v0.4.4** in small grey text.
2. **(a) Fast close:** open your main Claude, then the launcher → **+ Add account** → name → Continue. "Closing
   Claude…" should take about 1–2 s (before: ~8 s). Any extra account that was open stays open.
3. **(a) Reopened while closing:** Cancel that sign-in. Start **+ Add account** again and, right while "Closing
   Claude…" shows, open Claude yourself from the Start menu. The launcher stops at once with **"Claude was opened
   again"** / "Close it and try again." Your main Claude profile is untouched (it opens normally, signed in).
4. **(c) Window in front:** start **+ Add account** normally: the blank sign-in Claude window comes to the front by
   itself. Also click any account card: its Claude window comes to the front. If either one stays behind, tell me
   (and send `sign-in-timings.log`: it says `bring the sign-in window to the front: done` or `refused`).
5. **(b) Fast finish:** sign in in the blank window. A few seconds after the sign-in completes, the dialog shows
   "Saving the session" and finishes in about 2–4 s (before: up to ~35 s). Your main Claude reopens (if it was
   open) and the new account opens **signed in**; its card does **not** say "Not signed in".
6. **(b) Card check:** close the launcher and reopen it: the new card still has no "Not signed in". (Known: if you
   sign out inside that account's Claude, the card keeps looking signed in, because the token keys stay.)
7. **Cancel** and **I've signed in** work as in 0.4.3.
8. **Send me the timings:** `sign-in-timings.log` (launcher's data folder, next to `sign-in-check.log`:
   `%APPDATA%\Multi-Account Launcher for Claude` or `%APPDATA%\claude-launcher`). Only step names, paths and
   milliseconds. Expected: `start: close main Claude: forced: ~1500 ms` and `finish: total` of a few seconds.
9. If anything stops halfway, send me `login-pending.json` (`%LOCALAPPDATA%\ClaudeLauncher`, no secrets in it) and the
   names of the folders in `%LOCALAPPDATA%\Claude-Data`.
