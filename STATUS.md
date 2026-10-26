# Status

**Current phase:** 1.5 — Professional GitHub process (PR open, waiting for Thiago's test and merge).
Next: Phase 2 — Screen (starts only after the merge).

## Done

- Full planning (`docs/SCOPE.md`, `docs/WINDOWS.md`, `docs/PHASES.md`).
- Phase 0 on Thiago's PC (2026-10-26): isolated profile with `--user-data-dir` works on Claude 3.6556.2.0.
- Phase 1 (2026-10-26): `package.json` (Electron 44, electron-builder 26, per-user NSIS), `src/` layout, window with
  placeholder text, `src/core/greeting.js` + test, workflow building the `.exe` on Windows.
- Phase 1.5 (2026-10-26): renamed to **Multi-Account Launcher for Claude** (`claude-launcher/`), docs and interface in
  English (texts in `src/renderer/strings.ts`), PR flow in `CLAUDE.md`, PR template, `CHANGELOG.md`, automatic
  pre-release on merge to `main`, actions at v7, issues #1–#7 (one per phase), README badges and Download section,
  code migrated to TypeScript (`strict`, TypeScript 7, output in `out/`).

## Missing

- Phases 2 to 6 (`docs/PHASES.md`).
- Milestone "Multi-Account Launcher v1.0": the cloud session has no tool to create milestones. Thiago creates it on
  GitHub (Issues → Milestones → New milestone) and adds issues #1–#7 to it.
- The icon is still Electron's default (original icon comes in Phase 2).

## Decisions

- Electron + plain JS; `.exe` only through GitHub Actions; one PR per phase, release on merge.
- Extra accounts sign in by snapshot of the default profile, with stash and restore.
- Email and name detected automatically with manual fallback; photo chosen by the person, initial by default.
- Original icon and free serif font (no logo and no official Claude font).
- Dark theme only in v1; the launcher closes by itself after opening an account.
- TypeScript with plain `tsc` (no bundler); a small `scripts/copy-assets.mjs` copies the renderer's HTML/CSS into `out/`.
- `src/core` returns language-neutral keys (e.g. `greetingFor()` → `'morning'`); texts come from `strings.ts`.

## How to test

Phase 1.5 (after the merge):
1. On GitHub, open the **Releases** page of the repo and pick **Multi-Account Launcher for Claude 0.1.0** (tag
   `launcher-v0.1.0`, marked *Pre-release*). Download `Claude-Launcher-Setup-0.1.0.exe`.
   (Before the merge, the same installer is in the PR's Actions run, artifact **launcher-installer**.)
2. Run the installer. SmartScreen should complain (unsigned exe): "More info → Run anyway".
   Check that it **does not ask for administrator** rights (per-user install).
3. Open **Multi-Account Launcher for Claude** from the **Start menu**: dark window with the title
   "Multi-Account Launcher for Claude" and the text "Phase 1 skeleton. The real screen arrives in Phase 2."
   Closing the window quits the app.
4. Optional: uninstall the old "Multiconta para Claude" (Settings → Apps); the new app has a different id, so both
   can appear side by side.
