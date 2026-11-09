# Phase plan

Each phase = **a new cloud session** (a new session carries no history; it is the cloud's "/clear").
Model: Opus 5.5, effort `medium` (`high` only if stuck).
Each phase ends with a Pull Request to `main` and its own issue (`[launcher] Phase N — …`, milestone
"Multi-Account Launcher v1.0"). The maintainer downloads the installer (PR artifact, or the Release after the merge), tests it on
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

Done by hand on Windows 11, without Claude. Results in `WINDOWS.md`, section 1.

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
   - The maintainer tests and merges; the next phase starts only after the merge.
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

## Phase 4.1 — fixes and account controls ✅ (2026-10-27, version 0.4.2)

After testing 0.4.1 on the PC (email and Google sign-in, cancel and crash recovery all worked).

- Bugs: after a sign-in, open the new account too (not only the main Claude); wait for a visible window after opening
  (spawn once more after ~3 s, keep the launcher open if none after ~8 s); "Not signed in" from the claude.ai
  `sessionKey` cookie row (temporary copy, names and hosts only) instead of `config.json`; Add account closes only
  the default instance.
- Card ⋯ menu: **Close this account** (enabled only while running). **Remove** on a running account: "Close and
  remove". **I've signed in**: immediate, read-only check with a ~15 s countdown.
- Docs: `config.json` keys in `WINDOWS.md` §1; `lastKnownAccountUuid` as a Phase 5 candidate in §5.

## Phase 4.2 — sign-in speed and small UI ✅ (2026-10-27, version 0.4.3)

After testing 0.4.2 on the PC (all 7 tests passed).

- Add account / Sign in: the dialog opens at once with live steps ("Closing Claude…", "Preparing a clean profile…",
  "Opening sign-in window…"). Claude is asked to close and its exit polled every ~250 ms; after ~5 s only the
  default-profile processes are force-ended. Step timings in `sign-in-timings.log` (no secrets).
- Detection: the `oauth:tokenCache*` key names in `config.json` (polled every ~1 s) → graceful close → `sessionKey`
  cookie check → move. "I've signed in" stays as fallback with the same logic.
- Main card: fixed "Main" badge. Version label (`v0.4.3`) in the bottom-left corner.
- Docs: "Close this account" keeps the launcher open; "Running" = process open; signed-out state only known once
  the profile is closed (`SCOPE.md` §2.2–2.3).

## Phase 5 — Account details and photo ✅ (2026-11-04, version 0.5.0)

Read: `WINDOWS.md` §5, `SCOPE.md` §2.2–2.3.

Housekeeping first (2026-11-04):

- Node 24 in the workflow and `"engines": { "node": ">=24" }` in `package.json`. `scripts/*.mjs` → `.ts`, run directly
  by Node 24 (type stripping, no ts-node/tsx), type-checked by `npm run typecheck` (`scripts/tsconfig.json`).
- From 0.5.0 on, tags and release titles are `v<version>` (e.g. `v0.5.0`). Old `launcher-v*` tags stay as they are.
- Startup timing: log how long the launcher takes to show the cards (`sign-in-timings.log`, `startup: …`). Cookie
  checks run in the background after the cards are shown; the screen never waits for them.
- Remember the last known signed-in state of each account in the config (`signedIn`) and show it at once on
  startup; the background check updates it.
- After a sign-in, reopen the main Claude only if it had a **visible** window before the sign-in started. Running
  hidden (Claude may have no tray icon) or not running: leave it closed.

- First: diagnostic script (only keys and paths, never token values) to run on Windows and paste the output.
  Stop the phase here if the output does not exist yet.
- Then: detection in the order of section 5, with manual fallback. Also update the Main card.
  **Decided after the diagnostic:** local files are not reliable; v1 uses manual details only (e-mail required,
  real name optional) in Add account, plus **Edit details** in the ⋯ menu of every card. Option 2 stays noted in
  `WINDOWS.md` §5 as a possible later improvement.
- Change photo: pick an image, save a resized copy to `userData/photos/<id>.png`; "back to the initial".

## Phase 5.1 — Receive memories from… ✅ (2026-11-04, version 0.5.1)

A **guided assistant**, not an automatic transfer: memories live on Anthropic's servers and there is no official API,
so the launcher only walks the person through copying the text from one account and importing it into another.

- Entry: card ⋯ → **Receive memories from…** → list of the other **signed-in** accounts (the card that opens the
  menu is the target).
- Warning dialog first (buttons **Cancel** in red, **Proceed** in orange): imported memories are **added** to the
  target's existing ones; they may duplicate or conflict; the import is experimental; for work accounts, check the
  organization's rules before moving memories between accounts.
- **Step 1 — copy from the source account:** the launcher opens the source account. Instructions: Settings →
  Memory → Export memory → Export, which downloads a `.zip` of Markdown files (the memory files). The person drops
  the `.zip` on the assistant or picks it ("Choose a file…"); fallbacks: paste the text, or a `.txt`/`.md` file.
  Tip shown: if Export is not there, ask Claude "Write out all my memories verbatim." and paste the answer.
- **The `.zip` (fix before the 0.5.1 test, `src/core/memoryZip.ts`):** read in memory only, never extracted to disk,
  never logged. Only `.md` entries, joined with one heading per file (its path inside the zip, without Claude's
  `claude-memory-<date>/` folder), in path order.
  Paths with `..` are ignored; more than 500 entries, or more than 2 MB of real inflated text (not the declared
  size), is refused; a broken zip gives a clear message. Dependency-free: the zip records are parsed by hand and
  deflate goes through `DecompressionStream('deflate-raw')` (Chromium in the window, Node in the tests).
- **Choosing and splitting (after the PC test: 41 files, 131,248 characters):** a checklist of the files grouped by
  folder, each with its size in characters, and a running total. `projects/` starts unchecked (Project memories
  would land in the other account's general memory). The text box previews the checked files (read-only). Over
  100,000 characters, step 2 splits the checked files into parts of whole files, each under the limit: "Part 1 of
  N", **Copy part** / **Next part**, one Start import each. A file is never cut; one alone over the limit gets a
  message. Pasted text over the limit is reported with its length.
- **Step 2 — import into the target account:** the launcher opens the target account and puts the text on the
  clipboard. Instructions: Settings → Memory → Import memory from other AI providers → Start import (Claude shows a
  prompt meant for the other provider) → paste (Ctrl+V) → confirm. Buttons: **Copy again** (puts the text back on
  the clipboard) and **Done**.
- Menu names checked on Claude Desktop for Windows (UI in Portuguese: Configurações → Memória → Exportar /
  Iniciar importação); the support article's names (Your Claude, Manage, Add to memory) were outdated.
- Privacy: the text is kept **only in memory**, never written to disk or logs, and cleared on **Done** or **Cancel**.
- Tests: the warning comes first; the text never reaches a file or a log; Done and Cancel clear it; only signed-in
  accounts are offered as the source.

## Phase 5.2 — Self-update (2026-11-04, version 0.6.0)

Scope change (`SCOPE.md` §5–§6): the launcher updates itself.

- `electron-updater` with the GitHub provider (public repo, no token in the app); `publish` in `package.json` makes
  electron-builder write `app-update.yml` into the app and `latest.yml` + `.blockmap` into `dist/`. The release step
  uploads `latest.yml` and the `.blockmap` next to the `.exe` (checked on every CI run).
- On startup, after the cards show (never blocking them): one check. Newer release → dialog "Version X is available.
  Install now?" with **What's new** (opens the release page), **Later** (works normally, asks again next start) and
  **Install** (download with a progress bar, silent install, the launcher reopens). Errors: a short message with a
  link to the Releases page; nothing is ever forced. A failed check (offline, no `latest.yml`) is only logged.
- Never checks or installs while a sign-in or the memory assistant is in progress (the check waits until they end;
  Install is refused); sign-in and memories are refused while an update downloads.
- Code: `src/main/selfUpdate.ts` (logic, injected updater), `src/main/system/updater.ts` (electron-updater).
  Strings in `strings.update`. Logs: `update: …` lines with versions and timings only.
- Testers: `scripts/install-latest.ps1` installs the latest PR build; documented in the README.
- Tests (mocked updater): no update, update found, Later, Install with progress, download error, busy.
- 0.6.0 is installed by hand; the real test is 0.6.0 → 0.6.1 after the merge.

## 0.7.0 — Review and diagnostics (2026-11-05)

The last code changes before 1.0.0; Phase 6 then only does the README, the done-criteria review and the version.

- Review round (findings with file and line in the PR): security (IPC input, `shell.openExternal`, logs, zip limits,
  default-profile rule, self-update), accessibility (keyboard path through every dialog, focus back to the opener,
  labels of icon-only buttons, WCAG AA contrast of muted text), code health (dead code, unused strings and
  dependencies). Only clear bugs and real risks are fixed, no refactors.
- **Copy diagnostics** next to the version label: plain-text report on the clipboard (versions, accounts by card
  label and their state, cached paths with `%LOCALAPPDATA%` / `%USERPROFILE%`, last 50 lines of
  `sign-in-timings.log`); never e-mails, account names, tokens, cookies or memory text; "Copied" confirmation.
  Logic in `src/core/diagnostics.ts`, tests prove nothing personal reaches the report.

## Phase 6 — Polish and release ✅ (2026-11-07, version 1.0.0)

- `README.md` (what it is, how to install, SmartScreen, limitations, credits, notice that it is not affiliated with Anthropic).
- Review the done criteria (`SCOPE.md` §7). Version `1.0.0` in `package.json` → the merge creates the Release
  `v1.0.0`.

## After v1.0

Ideas live in [`docs/IDEAS.md`](./IDEAS.md) (list + suggested order) and [`docs/ideas/`](./ideas/) (details).
The phases below follow that order. Milestone "Multi-Account Launcher v1.x"; one issue per phase.
From here on each phase is a **new local session** of Claude Code on Windows (not a cloud session).

**Versions after 1.0:** each phase with new features bumps MINOR (1.1.0, 1.2.0 … 1.9.0, 1.10.0 …); fixes and small
additions between phases bump PATCH (1.1.1, 1.1.2 …); MAJOR (2.0.0) is a deliberate decision for a big change, never
reached by counting. The three numbers are compared as whole numbers (`src/core/version.ts`), so 1.2.0 is older than
1.12.0. Details in `docs/IDEAS.md` → "Versioning".

### Prompt to paste for each post-v1 phase

```
Phase N of Multi-Account Launcher for Claude (repo histuan/Claude-Launcher), local session on Windows.
1. Use the dev-economico skill.
2. Read CLAUDE.md, docs/STATUS.md, the "Phase N" section of docs/PHASES.md and the docs/ideas/ files it cites.
3. Do ONLY Phase N, on a branch claude/phase-N-<short-name>. When done: verification (typecheck and tests),
   update docs/STATUS.md (including "How to test"), CHANGELOG.md and docs/ideas/DONE.md, set the version in
   package.json to the one in the phase, open a Pull Request to main following the "GitHub process" section of
   CLAUDE.md (Closes #<phase issue>), and the final dev-economico report.
If something needs my real data or cannot be done, stop and explain instead of improvising.
```

## Phase 7 — Baseline measurements (no version) ✅ (2026-11-09, `docs/perf/README.md`)

Read: `docs/ideas/performance-and-size.md` ("Step 0" and "What to measure").

- Read-only round on the installed release: no app code changes. Agent-run: commands and, when a step needs the UI,
  computer use. Back up the default Claude profile first if any run could touch it.
- Each measurement repeated (≥ 20 runs where it makes sense; fewer for slow ones, with the count stated). The update
  split into download, install and first start.
- Raw data `docs/perf/<date>-baseline.csv`; summary in `docs/perf/README.md`; conclusion: where the time goes and
  what it means for the update progress window (Phase 8).
- Answer the eleven research questions in `docs/ideas/performance-and-size.md` ("Deep study"): `claude://` links per
  profile, usage page link, Claude updates with several instances open, hidden windows, MCP config per profile, first
  start of a new profile, what Claude updates change, a link to the memory import screen, the memory menu names
  after "Unified Claude", a weekly CI canary, and save fixtures of the current Claude version (names and shapes
  only, under `test/fixtures/`). Yes / no / how, with the command used.
- Memory assistant review: walk "Receive memories from…" and list the friction; stop before the
  import is confirmed unless I name accounts that may be changed (fixes go to a 1.1.x patch).
- Docs only: straight to `main`, no PR. Done when the summary exists.

## Phase 7.5 — Resilience against Claude updates (1.0.1)

Read: `docs/ideas/resilience.md`, the Phase 7 summary.

- Guards 1–10 of `docs/ideas/resilience.md`, the first three before anything else: a click on a card always opens the
  account; "unknown" is never shown as "signed out"; a second signal from the `config.json` key names.
- "I'm signed in" button in the sign-in dialog; exe from the package manifest; process and package fallbacks.
- Self-check after a Claude update (background, diagnostics, calm notice only on failure).
- Fixtures under `test/fixtures/claude-<version>/` (names and shapes only) for the Claude version on the PC.
- Test on the PC: with the cookie check forced to fail, every account still opens.

## Phase 8 — Greetings and update progress (1.1.0)

Read: `docs/ideas/greetings.md`, `docs/ideas/update-progress.md`, the Phase 7 summary.

- Varied greetings by time slot (late-night set included) and rare greetings (~1 in 200), pencil still only over the
  name.
- Something always on screen from **Install** to the new version (option chosen from the measurements).
- "What's new" = full version history (every version back to 0.1.0, current one highlighted, pre-1.0 tagged beta),
  from the bundled `CHANGELOG.md`; plain-language **Highlights** added to each existing version; **Release notes on
  GitHub** and **GitHub page** buttons at the top; the version label opens this screen.
- README "Windows" badge says Windows 11 (the only version tested) until Windows 10 is tested.
- Test the update from 1.0.0 on the PC after the merge (never by installing the PR artifact).

## Phase 9 — Settings, light theme, privacy mode (1.2.0)

Read: `docs/ideas/settings-and-theme.md`.

- Settings page (theme, language, at login, sign-in helper, updates, after opening an account, privacy mode,
  greeting, export/import, about, reset), config migration with tests; Ctrl+, opens it.
- Theme presets Warm dark (default), Graphite dark, Light and System, title bar included; contrast test for every
  preset; Windows high-contrast mode respected.
- Toast component; "E-mail copied" when signing in from a card.
- Visual polish pass over the main screen and dialogs; screenshots of every preset in `docs/screenshots/`.

## Phase 10 — Security review and community files (1.3.0)

Read: `docs/ideas/security-review.md`.

- Checklist with the `vibe-security` skill; report `docs/security-review-1.3.md`; small fixes in the PR, issues
  for the rest.
- `SECURITY.md`, issue templates, `CONTRIBUTING.md`, code of conduct, Discussions; Dependabot and CodeQL.
- "Report a problem" button (pre-filled issue with the anonymised diagnostics).
- After the merge: first **bug-hunt round** on the installed 1.3.0 (`docs/ideas/performance-and-size.md`), one issue
  per problem found.

## Phase 11 — Shortcuts and quality of life (1.4.0)

Read: `docs/ideas/shortcuts.md`, the Phase 7 research answers (`docs/perf/README.md`) and the comments on issue #37.

- `--open <card id>` command line; taskbar jump list; "Create shortcut" on the desktop per account.
- Quick actions with `claude://` links (New chat, New Code session, New Cowork task, Usage): Phase 7 and a manual
  check confirmed they reach the right profile.
- Keys 1–9, drag to reorder, accent colour per account, "Running (hidden)" with Show / Close (find the window with
  `EnumWindows`), duplicate e-mail warning; "Restart all accounts" if it proves needed.

## Phase 12 — First-run tour (1.5.0)

Read: `docs/ideas/onboarding.md`.

- Offer on a fresh install only; "Not now" points to Settings → Help; the tour can start again from there.
- Spotlight + coach-mark tour over every part of the app, keyboard and screen-reader friendly, reduced motion
  respected; nothing that changes accounts runs during it.

## Phase 13 — Performance and size (1.6.0)

Read: `docs/ideas/performance-and-size.md`, the Phase 7 summary.

- Each change measured before/after with the Phase 7 method; keep only what helps. Installer size, first start,
  sign-in window, opening an account (already-running case: ~2.6 s), launcher memory.

## Phase 14 — Presentation (1.7.0)

Read: `docs/ideas/presentation.md`.

- README overhaul with GIFs and screenshots of the theme presets, release notes format (from the Highlights),
  repository topics and social preview.
- Three short demo clips recorded with privacy mode on and test accounts (the tour can appear in one).
- Small website (`site/`) with the Download button for the latest release, on a host that is not flagged by Safe
  Browsing (GitHub Pages, or Vercel / Netlify if the github.io domain is flagged).
- Draft of one community post (published by the maintainer).

## Phase 15 — Português (Brasil) (1.8.0)

Read: `docs/ideas/settings-and-theme.md` ("Languages").

- One strings table per language with the same keys; a test checks every key and `{placeholder}` exists in every
  language; the Language setting from Phase 9 switches at once.
- Português (Brasil) translation of the whole interface, the tour included, written naturally (not word by word);
  English stays the fallback.
