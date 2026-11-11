# Phase plan

Phases 0–6 (up to v1.0.0) and their prompt are in [`phases-v1.md`](./phases-v1.md).

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

## Phase 7.5 — Resilience against Claude updates (1.0.1) ✅ (2026-11-10)

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
