# Status

**Current phase:** 4 — Sign-in by snapshot. 0.4.0 merged; fix 0.4.1 (real default profile path) in a PR, waiting for
Thiago's test and merge (issue #3).
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

## Missing

- Phases 5 and 6 (`docs/PHASES.md`).
- Milestone "Multi-Account Launcher v1.0": the cloud session has no tool to create milestones. Thiago creates it on
  GitHub (Issues → Milestones → New milestone) and adds the open phase issues (#1–#5) to it.

## Notes for Phase 5

- Email and real name are not detected yet: new cards show only their name (SCOPE §4.2.4, `docs/WINDOWS.md` §5).
  The signed-in profile is `account.profileDir`; `src/main/system/claudeProfile.ts` already reads its `config.json`.
- Sign-in was only tested with mocks and temp folders: the real MSIX behaviour (rename of the default folder while
  Claude is closed, the cookie flush timing, `taskkill /T /F`) is checked by Thiago's test. If detection never fires,
  the **I've signed in** button waits up to 40 s for the cookie flush, then saves (or reports "not saved").
- Not verified on the PC yet: automatic detection also needs the `oauth:tokenCache*` key in `<profile>\config.json`.
  If that file lives elsewhere on 3.6556.2.0, detection never fires and only **I've signed in** works (it still checks
  `Network\Cookies` for `sessionKey` before keeping anything). The "Not signed in" label uses the same file.
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
  was open before (cancel and success alike). "Signed in" for a card = `oauth:tokenCache*` key in its `config.json`;
  "session saved" = the text `sessionKey` in the cookie database files (cookie values are never read or logged).
  Minimum free space 500 MB on the drive of the default profile. The Add card is created only when the sign-in succeeds.

## How to test

Phase 4 (0.4.1, fix of 0.4.0: real profile path). **This phase moves your main Claude profile, so make the backup first.**

0. **Manual backup:** close Claude completely (also from the tray icon) and any Claude Code terminal. In File
   Explorer open `%LOCALAPPDATA%\Claude-Data` and copy the **claude_…** folder (≈1 GB; on your PC
   `claude_pzs8sxrjxfjjc`) somewhere else (e.g. Desktop\Claude-backup). If anything goes wrong: close Claude, delete
   the `claude_…` folder there and put the copy back with the same name.
1. Get `Claude-Launcher-Setup-0.4.1.exe`: before the merge, from the PR's Actions run (artifact
   **launcher-installer**); after the merge, from the **Releases** page (tag `launcher-v0.4.1`). Install over 0.4.0.
2. Open Claude normally (main account) and then the launcher. The 0.3.0 test card (if any) shows "Not signed in".
3. **+ Add account** → name "Work" → Continue: your main Claude closes, a blank Claude opens and the launcher shows
   "Use the new Claude window to sign in". While it is open, `%LOCALAPPDATA%\Claude-Data` has
   `claude_….launcher-stash` and `%LOCALAPPDATA%\ClaudeLauncher\login-pending.json` exists.
4. Sign in there with **another** account (try email and, on a second card, Google). Within about a minute the dialog
   goes to "Signed in" → "Saving the session…", the blank Claude closes, the **Work** card appears and your main Claude
   reopens **still signed in to your main account**. The stash folder and the marker are gone.
5. Click **Work**: Claude opens signed in to that account, next to the main one. If step 4 never moves on by itself,
   press **I've signed in** (it may wait up to 40 s) and tell me.
6. **Cancel:** start another Add, then press **Cancel** in the dialog: the blank Claude closes, no card is added and the
   main Claude comes back signed in.
7. **Crash/recovery:** start another Add, and while the dialog is open kill the launcher in Task Manager
   ("Multi-Account Launcher for Claude"). Open the launcher again: it asks "A sign-in was interrupted". **Restore main
   profile** → main Claude is back as before. (Optional: repeat and choose **Continue sign-in**.)
8. **Sign in on an existing card:** on the 0.3.0 card ("Not signed in"), click it → Continue → sign in → that card
   now opens signed in (no new card).
9. **Fail-safe / Claude Code:** with a Claude Code terminal open, start an Add: it stops with "Your Claude folder is
   in use" and nothing moves. If "+ Add account" is greyed out with "Adding accounts is turned off", send me
   `sign-in-check.log` (launcher's data folder under `%APPDATA%`): it lists the folders checked.
10. Send me `login-pending.json` (no secrets in it) if anything stops halfway, plus the names of the folders in
   `%LOCALAPPDATA%\Claude-Data`.
