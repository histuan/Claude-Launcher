# Phase plan

Each phase = **a new cloud session** (a new session carries no history; it is the cloud's "/clear").
Model: Opus 5.5, effort `medium` (`high` only if stuck).
Each phase ends with a Pull Request to `main` and its own issue (`[launcher] Phase N — …`, milestone
"Multi-Account Launcher v1.0"). Thiago downloads the installer (PR artifact, or the Release after the merge), tests it on
the PC and merges. The next phase starts only after the merge.

## Prompt to paste for each phase

Replace `N` with the phase number:

```
Phase N of Multi-Account Launcher for Claude (repo histuan/Claude-Launcher).
1. Use the dev-economico skill (if it does not exist in this session, say so in the report).
2. Read CLAUDE.md, docs/STATUS.md and the "Phase N" section of docs/PHASES.md.
   Read SCOPE.md and WINDOWS.md only in the sections the phase cites.
3. Do ONLY Phase N. When done: verification, update docs/STATUS.md (including "How to test") and CHANGELOG.md,
   bump the version in package.json to 0.N.0, open a Pull Request to main following the "GitHub process" section
   of CLAUDE.md, and the final dev-economico report.
If something in the phase is impossible in the cloud, stop and explain instead of improvising.
```

---

## Phase 0 — Tests on the PC ✅ (2026-10-26)

Done by Thiago, without Claude. Results in `WINDOWS.md`, section 1.

## Phase 1 — Skeleton and build ✅ (2026-10-26, commit `b839fa5`)

Read: `SCOPE.md` §5.

- `package.json` (Electron, electron-builder; NSIS per user).
- Structure `src/core`, `src/main`, `src/main/system`, `src/renderer`, `test/`. Window opens with placeholder text.
- `npm test` with `node:test` and 1 real test of `src/core`.
- `.github/workflows/claude-launcher.yml` **at the repo root**: test job (ubuntu) and build job (`windows-latest`):
  `npm ci`, `npm test`, `electron-builder --win --publish never`, `upload-artifact` of the installer.
- Done when: Actions is green (check with `gh run list` / `gh run view`) and the artifact exists.

## Phase 1.5 — Professional GitHub process

Goal: make the project look like a professional project and be **entirely in English**.

0. **Rename and translate (first):**
   - App name: **Multi-Account Launcher for Claude**.
   - Workflow: `git mv` to `.github/workflows/claude-launcher.yml`; artifact name `launcher-installer` and tags `launcher-v*`.
   - `package.json`: `name` `claude-launcher`, `productName` "Multi-Account Launcher for Claude",
     `appId` `com.histuan.claude-launcher`, installer name without spaces.
   - **Translate into English** all documentation: `CLAUDE.md`, `ESTADO.md` → `STATUS.md`, `docs/ESCOPO.md` → `docs/SCOPE.md`,
     `docs/WINDOWS.md`, `docs/FASES.md` → `docs/PHASES.md` (including the prompt template, with the new paths).
     Update all cross-references.
   - **Interface in English**, with all texts in a single module (`src/renderer/strings.ts`) so other languages can be
     added later. Greeting: "Good morning" (5:00–11:59), "Good afternoon" (12:00–17:59), "Good evening" (18:00–4:59);
     card "Main"; menu "Rename / Change photo / Remove"; button "Add account"; indicator "● Running".
   - **Migrate to TypeScript** (all code, tests included): `strict: true`, compile with `tsc` to an output folder
     ignored by git (`out/`), no bundler unless really needed. Scripts: `build`, `typecheck`, `test`
     (runs the compiled tests with `node --test`). The preload stays CommonJS (sandbox). CI runs `typecheck` and `test`
     before the build, and `electron-builder` packages the compiled output.
   - Everything below uses the new names: commit scope `launcher`, tags `launcher-v*`, milestone
     "Multi-Account Launcher v1.0".
1. **PR flow:** rewrite the commits part of `CLAUDE.md` as a "GitHub process" section:
   - each phase works on the session branch and ends with a **Pull Request to `main`** (never push directly to `main`);
   - commits follow *Conventional Commits* with the `launcher` scope (`feat(launcher): …`, `fix(…)`, `docs(…)`, `ci(…)`);
   - PR description from the PR template (`.github/pull_request_template.md`), with `Closes #<phase issue>`;
   - the phase bumps the version in `package.json` to `0.N.0` (Phase 1.5 keeps `0.1.0`) and adds its section to `CHANGELOG.md`;
   - Thiago tests and merges; the next phase starts only after the merge.
2. **PR template** at `.github/pull_request_template.md`: Summary, Why, How it was tested, Screenshots, Checklist.
3. **`CHANGELOG.md`** following *Keep a Changelog*, with the `0.1.0` entry (Phase 1) and `Unreleased`.
4. **Automatic release on merge:** in the workflow, after the build on `windows-latest`, when the event is a push to `main`
   and the tag `launcher-v<package.json version>` does not exist yet: create the tag and the Release with the `.exe`
   installer, notes = that version's section of `CHANGELOG.md`, marked as *pre-release* while the version is `< 1.0.0`.
   Keep the `upload-artifact` (useful to test PRs before the merge).
5. **Update the workflow actions** to their current versions (check on GitHub which they are; today they warn about Node 20).
6. **Issues:** create the milestone "Multi-Account Launcher v1.0" and one issue per phase (Phase 1 to 6, short title and
   checklist taken from this file), in English. Close the Phase 1 issue citing commit `b839fa5`. This phase closes its
   own issue in the PR. If the tools lack permission for this in the cloud, list what was missing in the report.
7. Project **README**: workflow badge, latest release badge, "Download" section pointing to the Releases page,
   and a link to the CHANGELOG.
8. Update the "How to test" in `STATUS.md` to use the **Releases** page instead of Artifacts.

Done when: the PR is open with the template filled in, Actions passes on the PR, and after the merge the Release
`launcher-v0.1.0` (pre-release) appears with the installer.

## Phase 1.6 — Standalone repository ✅ (2026-10-26)

The project was split out of the `histuan/projects` monorepo (history preserved) into `histuan/Claude-Launcher`,
with the project at the repo root. No version bump (stays `0.1.0`).

- Workflow: no `paths` filters, no `working-directory` default, artifact and npm cache paths at the root.
  Release on merge unchanged.
- PR template moved to `.github/pull_request_template.md` (GitHub pre-fills it again).
- `CLAUDE.md`, this file (prompt template included), `README.md` (badges and links) and `STATUS.md` point to
  `histuan/Claude-Launcher`, with no monorepo rules left.
- Phase issues in the new repo: Phase 2 = #4, Phase 3 = #5, Phase 4 = #3, Phase 5 = #2, Phase 6 = #1.

Done when: the PR is open and its workflow run is green.

## Phase 2 — Screen ✅ (2026-10-26)

Read: `SCOPE.md` §2, §3.

- Full screen with fake data: greeting (time rule + Windows name + pencil on the name only), cards, Main card,
  horizontal scrolling, add button, ⋯ menu (rename and remove already working in the config; change photo may stay visual).
- All texts in `src/renderer/strings.ts`.
- Theme CSS variables in one place. Fonts via `@fontsource`. Original icon in SVG + `.ico` for the app and the installer.
- Launcher config (JSON in `userData`): `{ version, greetingName, accounts: [{ id, label, email, realName, photo, profileDir }] }`
  (`profileDir: null` = Main).
- Tests: time rule, name cleanup (`"histuan ."` → `histuan`), config read/write.
- Offscreen screenshot if possible (one image).

## Phase 3 — Open accounts ✅ (2026-10-26)

Read: `WINDOWS.md` §1, §2, §3.

- `system/claudeApp.js`: resolve the exe (MSIX, old fallback, clear error if there is none).
- Open account: Main without flag; others with `--user-data-dir`. The launcher closes by itself afterwards.
- "● Running" indicator: process query filtered by path, every ~3 s while the window is visible.
- Temporary until Phase 4: "Add account" only creates the card and the profile folder (no sign-in).
- Tests with PowerShell mocks (sample JSON outputs, including Claude Code CLI processes that must be ignored).
- Release type: from 0.3.0 on (the first usable version), publish regular releases marked as latest instead of
  pre-releases; update the workflow, `CLAUDE.md` and any doc that says pre-release while < 1.0.0.

## Phase 4 — Sign-in by snapshot ✅ (2026-10-26)

Read: `WINDOWS.md` §4. Look at `engine.py` from ai-multi-instance (only the sign-in functions).

- Full flow of section 4, with marker, stash, restore, cancel and recovery on startup.
- Cards created in 0.3.0 (profile folder, but never signed in) get a **Sign in** action that runs the same flow on
  that card's profile instead of creating a new card.
- Tests with real temporary folders: they run on Linux **and** in the `windows-latest` job. Cover: success, cancel,
  "crash" in the middle (marker present on startup), default process still alive (abort).
- "How to test" in `docs/STATUS.md` with a **manual backup first** (copy the default profile folder somewhere else).

## Phase 5 — Account details and photo

Read: `WINDOWS.md` §5, `SCOPE.md` §2.2–2.3.

- First: diagnostic script (only keys and paths, never token values) for Thiago to run and paste the output.
  Stop the phase here if the output does not exist yet.
- Then: detection in the order of section 5, with manual fallback. Also update the Main card.
- Change photo: pick an image, save a resized copy to `userData/photos/<id>.png`; "back to the initial".

## Phase 6 — Polish and release

- `README.md` (what it is, how to install, SmartScreen, limitations, credits, notice that it is not affiliated with Anthropic).
- Review the done criteria (`SCOPE.md` §7). Version `1.0.0` in `package.json` → the merge creates the Release
  `launcher-v1.0.0`.
