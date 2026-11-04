# Status

**Current phase:** 5.2 — Self-update (0.6.0), in a PR to `main`, waiting for Thiago's test and merge.
Next: Phase 6 — Polish and release (`docs/PHASES.md`), after the merge.

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

- Phase 5 (0.5.0): Add account asks for the e-mail (required) and real name (optional); **Edit details** on every
  card (Main too); **Change photo** (PNG/JPG/WebP → centre square, 256 × 256 PNG in `userData/photos/<id>.png`, shown
  as a circle; **Back to the initial**). Cards show the last known signed-in state from the config at once; cookie
  checks run after the cards are on screen. `startup: cards shown: …` in `sign-in-timings.log`. Main Claude reopened
  after a sign-in only if it had a visible window. Node 24, scripts in TypeScript, tags `v<version>`.
  Screenshots (mocked): `docs/screenshots/phase-5-cards.png`, `docs/screenshots/phase-5-add.png`.

- Phase 5.1 (0.5.1): **Receive memories from…** in the ⋯ menu (`src/main/memoryTransfer.ts`, `src/core/memories.ts`):
  sources = the other signed-in accounts (Main counts as signed in; "Checking…" does not); warning first (Cancel red,
  Proceed orange); step 1 opens the source (launcher stays open), drop or pick the exported `.zip` (read in memory by
  `src/core/memoryZip.ts`, `.md` entries only, limits in `docs/PHASES.md`), or paste / `.txt` / `.md`. A `.zip` gives a
  checklist grouped by folder (`claude-memory-<date>/` dropped; `projects/` unchecked; size of each file and running
  total); the box is a read-only preview of the checked files. Over 100,000 characters, step 2 imports parts of whole
  files (`splitMemoryParts` in `src/core/memories.ts`): "Part 1 of N", Copy part / Next part, then Done; one file over
  the limit = a message, never cut. Step 2 puts part 1 on the clipboard and opens the target. Parts only in memory
  (main process), cleared on Done / Cancel / Esc / window close; the clipboard is emptied only if it still holds one
  of them. Logs: step names and part numbers only.
  Startup cache: `windowsName` and `defaultProfile` in the config (`src/core/cachedLookup.ts`), refreshed after the
  cards are shown (`startup: background refresh …` in the log). Screenshots (mocked):
  `docs/screenshots/phase-5.1-warning.png`, `docs/screenshots/phase-5.1-step1.png` (checklist),
  `docs/screenshots/phase-5.1-parts.png` (step 2 in parts).

- Phase 5.2 (0.6.0): **self-update** (`src/main/selfUpdate.ts`, `src/main/system/updater.ts`): `electron-updater`,
  GitHub provider, one check per start after the cards are shown (installed app on Windows only); dialog "Version X
  is available. Install now?" with What's new / Later / Install; download with progress, silent install, reopen;
  errors = short message + Releases link. Waits while a sign-in or the memory assistant runs; sign-in and memories
  are refused while an update downloads. Releases now carry `latest.yml` + `.blockmap` (checked on every CI run).
  `scripts/install-latest.ps1` (placeholder until Thiago pastes his script). Screenshots (mocked):
  `docs/screenshots/phase-5.2-available.png`, `phase-5.2-downloading.png`, `phase-5.2-failed.png`.

## Missing

- Phase 6 (`docs/PHASES.md`).

## Notes for the next phases

- Self-update: the first real test is 0.6.0 → 0.6.1 (0.5.1 and older have no updater; v0.5.1 has no `latest.yml`, so
  a 0.6.0 PR build only logs `update: check failed` until v0.6.0 is released). A failed check is never shown.
- `scripts/install-latest.ps1` is a placeholder: Thiago replaces it with his
  `%USERPROFILE%\Claude-Launcher-tools\install-latest.ps1`.
- Unsigned `.exe`: electron-updater verifies the signature only when `publisherName` is set (it is not), so unsigned
  updates install. If the installer is ever signed, set `win.publisherName` at the same time.

- E-mail and real name are typed by the person (`docs/WINDOWS.md` §5). Reading them via the `sessionKey` cookie and
  the claude.ai endpoint is a possible later improvement, not v1.
- Startup (0.5.1): only the very first start (no cache yet) waits for the Windows name and main-profile lookups.
- Memories: the menu paths are Thiago's translation of the Portuguese UI (Configurações → Memória → Exportar /
  Iniciar importação). If the English UI words them differently, only `strings.memories` changes. Export layout
  (PC test): `claude-memory-<date>/<memory path>.md`, 41 files and 131,248 characters on Thiago's account.
- Not verified: whether Claude's Start import accepts a second import right after the first (the parts flow assumes
  it does), and whether a paste near 100,000 characters goes through in one go.
- Not verified on the PC yet: the window query (`Get-Process` `MainWindowHandle` joined to `Win32_Process` by id),
  now also used to decide whether the main Claude is reopened after a sign-in.
- `launchClaude` uses `windowsHide: true` (CLAUDE.md rule 7). libuv also applies it to GUI windows (`SW_HIDE` in
  `STARTUPINFO`); if Claude's window does not appear when opened from the launcher, this is the first suspect.
- Old (non-MSIX) install: it opens, but the "Running" indicator and sign-in only support the MSIX package.

## Decisions

- Electron + TypeScript; `.exe` only through GitHub Actions; one PR per phase, release on merge.
- Own repository (`histuan/Claude-Launcher`), project at the root. The PR template is `.github/pull_request_template.md`.
- Extra accounts sign in by snapshot of the default profile, with stash and restore.
- Email and name detected automatically with manual fallback; photo chosen by the person, initial by default.
- Original icon and free serif font (no logo and no official Claude font).
- Dark theme only in v1; the launcher closes by itself after opening an account.
- TypeScript with plain `tsc` (no bundler); a small `scripts/copy-assets.ts` copies the renderer's HTML/CSS into `out/`.
- `src/core` returns language-neutral keys (e.g. `greetingFor()` → `'morning'`); texts come from `strings.ts`.
- Config: Main is the account with `profileDir: null`, always first, never removed; its `label` is `null` until renamed
  (shows `strings.mainAccount`). Other accounts: `profileDir` = `%USERPROFILE%\ClaudeProfiles\<id>` (from the env var).
  Names are trimmed and capped at 40 characters. An unreadable config is renamed to `config.json.corrupt-<time>`.
- Greeting name: Enter **or leaving the field** saves, Esc cancels, empty restores the Windows name.
- Fonts: `@fontsource-variable/source-serif-4` and `@fontsource-variable/inter` (variable weight), copied with their
  OFL licenses into `out/` by `scripts/copy-assets.ts`.
- Icon: `npm run icon` renders `build/icon.svg` with Playwright (not a project dependency) into `build/icon.ico`.
- Profile ids come from the card name (ASCII slug, e.g. "Trabalho Ágil" → `trabalho-agil`), unique, never a Windows
  device name nor a folder that already exists; the folder name is the id. The launcher only creates or deletes folders
  directly inside `%USERPROFILE%\ClaudeProfiles` (`isLauncherProfileDir`).
- Process filtering by exe path is done in `src/core/processes.ts` (tested); PowerShell only lists `claude.exe`.
- Card size: CSS px already follow Windows scaling, so sizes are set for 100 % (160 × 200 shows as 240 × 300 at 150 %). 0.5.0: 160 × 216, for e-mail + name above the Main badge.
- Releases: regular and marked as latest since 0.3.0.
- Sign-in (0.4.4): the default Claude is asked to close (`taskkill /PID <pid> /T`, no `/F`), its exit is checked every
  ~250 ms (`process.kill(pid, 0)`), and after ~1 s what is left of the default profile is force-ended
  (`taskkill /T /F`, as ai-multi-instance does); a default-profile pid that was not there at the start = "reopened",
  stop at once and never end it. Finishing: after the keys appear, the launcher waits for the `Network\Cookies`
  write (stat only, max ~45 s, then Wait longer / Cancel), ~1 s more, then force-ends the sign-in Claude (the close
  request never works). A failed
  process query counts as "still running" (abort), never as "closed". The main Claude is reopened at the end only if it
  had a visible window before (0.5.0; running hidden or not running = left closed; cancel and success alike); after a success the new account opens too.
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

Phase 5.2 (0.6.0). The real test is 0.6.0 → 0.6.1, after the merge.

1. **Install 0.6.0 by hand:** before the merge, the PR's latest Actions run (artifact **launcher-installer**, or
   `scripts/install-latest.ps1`); after the merge, `Claude-Launcher-Setup-0.6.0.exe` from the Releases page (tag
   **`v0.6.0`**, which must also list `latest.yml` and `Claude-Launcher-Setup-0.6.0.exe.blockmap`). Version label:
   **v0.6.0**.
2. **No update:** open the launcher. Cards appear as fast as before and no dialog shows. `sign-in-timings.log` (hover
   the version label for the path) has `update: check: none newer than 0.6.0 (… ms)` after the `startup:` lines
   (before v0.6.0 is released: `update: check failed (… ms)`, also with no dialog).
3. **0.6.0 → 0.6.1:** when the next PR is merged and `v0.6.1` is released, open 0.6.0:
   - "Version 0.6.1 is available. Install now?" shows after the cards, never before them.
   - **What's new** opens the v0.6.1 release page in the browser; the dialog stays.
   - **Later**: the launcher works normally. Close it and open it again: it asks again.
   - **Install**: a progress bar, then the launcher closes and opens again by itself (no installer window, no
     admin prompt) with **v0.6.1** in the corner. Accounts, names and photos are all still there.
4. **Error:** with 0.6.0 and the dialog showing, turn Wi-Fi off and click Install: "Couldn't update to version
   0.6.1", with a link to the Releases page and Close; the launcher keeps working.
5. Send me the `update:` lines of `sign-in-timings.log` (versions and timings only).
