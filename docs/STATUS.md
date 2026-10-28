# Status

**Current phase:** 4.4 — Card check after a sign-out (0.4.5), in a PR to `main`, waiting for Thiago's test and merge.
0.4.4 (PR #14, merged) tested on the PC: sign-in works (`finish: wait for the cookie write: written: 24965 ms`, the new
account opens signed in); but after a sign-out inside Claude the card still looked signed in. First 0.4.5 build
tested too: its log proved the cookie database is locked (`EBUSY`) while Claude runs and for a few seconds after
"Close this account", and the keys fallback answered "signed in"; this PR now has the fix for that.
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
  stashed); finishing = keys seen → wait for the `Network\Cookies` write (stat only, ~500 ms polls, max ~45 s) →
  ~1 s → force-end → move; no write = nothing moves, "The sign-in was not saved yet" with Wait longer / Cancel;
  card signed in = `sessionKey` cookie (keys only if the cookie DB can't be read); Claude's window brought to the
  front (best effort); version label bottom-right with the log path as tooltip. Earlier builds that ended Claude
  after ~2 s or a ~5 s quiet folder opened the account signed out: the sign-in needs Chromium's ~30 s cookie commit.

- Phase 4.4 (0.4.5): card check = a `sessionKey` row that is not expired and not empty (lengths only); the
  `oauth:tokenCache` keys never decide; running accounts are not read (their cookie database is locked); when an
  account stops running it is read at once and, while still locked, every ~1 s for up to ~10 s (**Checking…** on the
  card, then it updates by itself); each final decision goes to `sign-in-timings.log` (`card check <id>: …`).
  Cause of the 0.4.4 report (from the first 0.4.5 build's log): copy failed with `EBUSY` right after the close, and
  the keys fallback said "signed in".

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
  stop at once and never end it. Finishing: after the keys appear, the launcher waits for the `Network\Cookies`
  write (stat only, max ~45 s, then Wait longer / Cancel), ~1 s more, then force-ends the sign-in Claude (the close
  request never works). A failed
  process query counts as "still running" (abort), never as "closed". The main Claude is reopened at the end only if it
  was open before (cancel and success alike); after a success the new account opens too.
  "Session saved" (inside the sign-in, blank profile) = the text `sessionKey` in the cookie database files.
- "Signed in" for a card (0.4.5) = a claude.ai `sessionKey` row in `<profile>\Network\Cookies`, not expired and not
  empty (queried with the built-in `node:sqlite` on a temporary copy with its `-journal` / `-wal`; names, hosts,
  expiry and value lengths only, never values; copy deleted). The `oauth:tokenCache*` keys never decide (they stay
  after a sign-out). A running account keeps its last known state: a sign-out inside Claude is only seen after the
  account is closed (`docs/WINDOWS.md` §1, §4). A plain cookie text search is not enough: SQLite keeps a deleted
  row's text in free pages after a sign-out.
- Opening an account waits up to ~8 s for that profile's visible window (spawns once more after ~3 s); the launcher
  closes only then. "Close this account" / "Close and remove" end only that profile's main processes
  (`taskkill /T /F`): Main = no `--user-data-dir`, extra = its own `--user-data-dir`.
  Minimum free space 500 MB on the drive of the default profile. The Add card is created only when the sign-in succeeds.

## How to test

Phase 4.4 (0.4.5). Sign-in still moves your main Claude profile for a moment: keep a backup of
`%LOCALAPPDATA%\Claude-Data\claude_…` (copied elsewhere with Claude fully closed).

0. Get `Claude-Launcher-Setup-0.4.5.exe`: before the merge, from this PR's latest Actions run (artifact
   **launcher-installer**); after the merge, from the **Releases** page (tag `launcher-v0.4.5`). Install over 0.4.4.
   The version label (bottom-right) says **v0.4.5**.
1. **Signed-in card:** use an extra account that is signed in. Open the launcher: its card has no "Not signed in".
2. **Log out, then close:** open that account, **Log out inside Claude**, wait about **1 minute** (Claude writes
   cookies about every 30 s), then open the launcher. While it runs the card still shows only **Running** (a sign-out
   cannot be seen while Claude runs). Use ⋯ → **Close this account**. Within ~3 s "Running" goes away; the card may
   show **Checking…** for a few seconds, then by itself **Not signed in** (clicking it starts Sign in). It must not
   stay on "Checking…" for more than ~10 s.
3. **Reopen the launcher** (close it and open it again): the card still says **Not signed in**.
4. **Send me the log lines:** `%APPDATA%\claude-launcher\sign-in-timings.log` (hover the version label for the
   path). Copy the lines that start with `card check` (only account ids, decisions and error codes; never cookie
   data). Expected after step 2: `card check <id>: cookie not found`. If you see `cookie DB unreadable (…) for ~10 s
   -> kept: …`, the file stayed locked longer than ~10 s: tell me.
5. Sign-in (Add account) works as in 0.4.4: the new account's card has no "Not signed in".
