# Status

**Current phase:** 2 — Screen, done on 2026-10-26 (PR open, waiting for Thiago's test and merge; issue #4).
Next: Phase 3 — Open accounts (issue #5).

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

## Missing

- Phases 3 to 6 (`docs/PHASES.md`).
- Milestone "Multi-Account Launcher v1.0": the cloud session has no tool to create milestones. Thiago creates it on
  GitHub (Issues → Milestones → New milestone) and adds the open phase issues (#1–#5) to it.

## Notes for Phase 3 (left open by Phase 2 on purpose)

- Sample accounts: the first run seeds `demo-work` and `demo-college` (`demoConfig` in `src/core/config.ts`, called in
  `src/main/main.ts`). Phase 3 must seed only Main (`defaultConfig`) and drop `demo-*` accounts from existing configs.
- Remove only deletes the account from the config. Deleting its profile folder (SCOPE §2.3) belongs with the code
  that creates folders (Phase 3); update `strings.remove.body` then.
- Not wired yet: clicking a card (open), the **Add account** button, the "● Running" indicator (`strings.running`).
- The greeting waits for the PowerShell name query (timeout 5 s) before the screen fills in. If it feels slow on the
  PC, cache the name in the config.

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

## How to test

Phase 2 (0.2.0):
1. Get `Claude-Launcher-Setup-0.2.0.exe`: before the merge, from the PR's Actions run (artifact
   **launcher-installer**); after the merge, from the **Releases** page (tag `launcher-v0.2.0`, *Pre-release*).
2. Install (SmartScreen: "More info → Run anyway"; no administrator prompt). The installer and the Start menu entry
   show the new icon (two coral sparkles on a dark tile).
3. Open the app: dark window ~900 × 600 with dark title bar and Windows buttons; it cannot shrink below ~720 × 480.
4. Greeting: "Good morning/afternoon/evening, histuan" (first word of your Windows name, without the " ."). Hover
   **only the name**: a pencil appears. Click the name, type another name, Enter → it stays after closing and opening
   the app. Edit again and clear the field → back to "histuan". Esc cancels.
5. Cards: **Main** (no email yet), **Work** and **College** (sample data). Hover highlights in coral; Tab moves focus.
   The College email is cut with "…" and shows the full text on hover. Shrink the window: the row scrolls sideways.
6. ⋯ menu: **Rename** works on every card (empty name on Main → back to "Main"); **Change photo** is greyed out;
   **Remove** appears only on Work/College and asks for confirmation. Close and reopen the app: changes are kept.
7. Clicking a card and **+ Add account** do nothing yet (Phase 3).
8. The config is `config.json` in the launcher's folder under `%APPDATA%` (`Multi-Account Launcher for Claude` or
   `claude-launcher`; not checked on Windows yet: note which one in the PR).
