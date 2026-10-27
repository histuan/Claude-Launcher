# Status

**Current phase:** 4.1 — Fixes and account controls (0.4.2), in a PR, waiting for Thiago's test and merge.
0.4.0 and 0.4.1 merged; on the PC, sign-in by email and Google, cancel and crash recovery worked.
Next: Phase 5 — Account details and photo (issue #2).

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
- Sign-in (Phase 4): the default Claude is closed with `taskkill /PID <pid> /T /F` (as ai-multi-instance does); a failed
  process query counts as "still running" (abort), never as "closed". The main Claude is reopened at the end only if it
  was open before (cancel and success alike); after a success the new account opens too.
  "Session saved" (inside the sign-in, blank profile) = the text `sessionKey` in the cookie database files.
- "Signed in" for a card (0.4.2) = a claude.ai `sessionKey` row in `<profile>\Network\Cookies`, queried with the
  built-in `node:sqlite` on a temporary copy (names and hosts only, never values; copy deleted). A running account
  keeps its last known state; `config.json` oauth keys only when the database cannot be read. A plain text search is
  not enough: SQLite keeps a deleted row's text in free pages after a sign-out.
- Opening an account waits up to ~8 s for that profile's visible window (spawns once more after ~3 s); the launcher
  closes only then. "Close this account" / "Close and remove" end only that profile's main processes
  (`taskkill /T /F`): Main = no `--user-data-dir`, extra = its own `--user-data-dir`.
  Minimum free space 500 MB on the drive of the default profile. The Add card is created only when the sign-in succeeds.

## How to test

Phase 4.1 (0.4.2). Sign-in still moves your main Claude profile for a moment: keep the backup from the 0.4.1 test
(`%LOCALAPPDATA%\Claude-Data\claude_…` copied elsewhere), or make a new one with Claude fully closed.

0. Get `Claude-Launcher-Setup-0.4.2.exe`: before the merge, from the PR's Actions run (artifact
   **launcher-installer**); after the merge, from the **Releases** page (tag `launcher-v0.4.2`). Install over 0.4.1.
1. **(a) New account opens after sign-in:** open your main Claude, then the launcher → **+ Add account** → name it →
   sign in with another account. At the end your main Claude reopens **and** the new account's Claude opens, signed
   in; the launcher closes once that window shows.
2. **(b) First open shows a window:** quit that new account (step 5 below, or from its tray icon), then click its card
   once. Its Claude window must appear with one click and only then the launcher closes. If no window appears within
   ~8 s, the launcher stays open with "Claude is starting in the background" (tell me if you see this).
3. **(c) "Not signed in":** in an extra account's Claude, sign out from inside Claude, then close it with **Close
   this account** (step 5). Reopen the launcher: that card says **Not signed in**. Sign in on it again (card → Continue)
   and it no longer says so. While an account is running, its label does not change.
4. **(d) Add account keeps extra accounts open:** with an extra account open, start **+ Add account**: only the main
   Claude closes; the extra account's window stays. Cancel the dialog afterwards.
5. **(e) Close this account:** open an account, reopen the launcher, wait for **Running** on its card, then ⋯ →
   **Close this account**: that Claude disappears (also from the tray) and **Running** goes off; other accounts stay
   open. On a card that is not running, the item is greyed ("This account is not running"). Also try it on Main.
6. **(f) Remove a running account:** with a test account running, ⋯ → **Remove**: the dialog offers **Cancel** and
   **Close and remove**. Cancel keeps everything; Close and remove closes only that account and removes the card.
7. **(g) I've signed in:** start **+ Add account** and, **before** signing in, press **I've signed in**: it shows
   "Checking… (15 s)" counting down, Cancel works meanwhile, and at the end "No sign-in found…"; the blank Claude stays
   open and nothing moves. Now sign in there and press it again: it continues at once (or within the countdown).
8. **(h) Docs:** nothing to test (`docs/WINDOWS.md` §1 and §5 record the `config.json` keys).
9. If anything stops halfway, send me `login-pending.json` (`%LOCALAPPDATA%\ClaudeLauncher`, no secrets in it) and the
   names of the folders in `%LOCALAPPDATA%\Claude-Data`.
