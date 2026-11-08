# Performance and size — baseline now (step 0), work in 1.4.0

## Goal
Make start-up, sign-in, opening an account and updating faster, and the installer smaller, based on measurements
rather than guesses. Also understand the Claude desktop app well enough to find faster paths.

## Who runs the tests
The AI agent runs the experiments on the maintainer's PC: it runs commands, drives the screen when a step needs the
UI (computer use), repeats each measurement dozens of times, records the timings and summarises them. The maintainer
only approves the start and anything that touches real data. These are the repetitive tests that would be too tiring
to do by hand.

Ground rules:
- Back up the default Claude profile before any run that could touch it; prefer test profiles.
- Never log tokens, cookies or personal data; timings and versions only.
- Raw results in `docs/perf/<date>-<topic>.csv`, summary (median, p90, number of runs, machine, Claude version) in
  `docs/perf/README.md`.

## Step 0: baseline (read-only, no code changes)
Measure the current release with the table below and write the summary. No optimisation in this step: it only
answers "where does the time go?", which also decides how the update progress window in 1.1 should work.

## What to measure
| Measurement | From → to | Today (known) |
|---|---|---|
| Normal start | launcher process start → cards visible | ~0.3–1 s (`startup:` log) |
| First start after install | same, right after an install | 5.8 s |
| Open an account | click → Claude window visible (new instance / already running) | ? |
| Sign-in window | "Add account" confirmed → sign-in window ready | ? |
| Update | click Install → new version visible (full and differential); split into download, install, first start | ~20 s install |
| Installer size | `.exe` size, and what is inside it | ~121 MB |
| Memory | launcher working set idle with 3 cards | ? |

## Deep study of the Claude desktop app (Phase 7 research questions)
Each answer goes in the Phase 7 summary as yes / no / how, with the command used (no personal data):
1. **Links per profile:** does `claude.exe --user-data-dir=<profile> "claude://claude.ai/new"` open a new chat in
   *that* account, when it is closed and when it is already running? Same for `claude://code/new` and
   `claude://cowork/new`. (Unlocks the quick actions in `shortcuts.md`.)
2. **Usage page:** is there any link or argument that opens Settings → Usage inside a given profile?
3. **Updates with several instances:** when Claude updates itself, do open extra instances delay or block it? Does a
   restart of every instance let it apply? (Decides "Restart all accounts".)
4. **Hidden windows:** after closing Claude's window it keeps running with no visible window on this PC. Can the
   launcher find that process's window per profile, show it again, or close it cleanly?
5. **Config per profile:** where each profile keeps `claude_desktop_config.json` (MCP servers), so copying MCP servers
   between accounts can be designed. Keys and paths only, never values.
6. **First start of a new profile:** what it creates and how long it takes; can anything be done ahead of time
   without touching session data?
7. **What changes between Claude updates** (paths, process names, arguments) that could break the launcher; turn
   findings into checks in the diagnostics and the compatibility notice.
8. **Memory import screen:** is there a `claude://` link (or an argument) that opens the memory import screen, or
   the "Import memory to Claude" card on the home screen, inside a given profile? If yes, the memory assistant can
   open the target account straight on it.
9. **Memory menu names after "Unified Claude"** (rolled out from 2026-11-10): what the Settings path to the memory
   import and export is called now, in English and in Portuguese. The help center says Settings → **Your Claude**
   (older layout: Settings → **Memory**); the assistant's steps must match what the app shows. If Phase 7 runs before
   the change reaches the PC, answer for the current layout and repeat this one question afterwards.

## Memory assistant review (with the Phase 7 answers)
Walk through "Receive memories from…" end to end on the PC with two test accounts and note every manual step and its
time. Candidates to remove friction, kept only if they work:
- **Pick the export by itself:** after step 1, look in the Downloads folder for the newest `claude-memory-*.zip`
  created since the assistant opened and offer it ("Use this file?"), instead of asking to drop it. Read-only, local.
- **Open the import screen directly** if question 8 finds a link.
- **Step texts that survive renames:** name both menu paths ("Your Claude" or "Memory") and the home-screen card.
- **Check the result:** a last step asking the person to look at the new entries, since Anthropic marks the import
  as experimental and it may drop or merge items.

## Bug-hunt round (after 1.3, then before each MINOR release)
The agent uses the installed app like a person would: every menu and dialog, very long and odd names, emoji, empty
fields, closing Claude or the launcher at the wrong moment, sleeping the PC mid sign-in, two launchers at once,
offline start. Each problem becomes an issue with steps to reproduce; nothing is fixed in the same session unless it is
trivial.

## Tech-debt review (with 1.4)
A short list of code worth simplifying (largest files first: `src/renderer/app.ts`, `src/main/main.ts`,
`src/main/signInFlow.ts`), each item with the reason and the risk; only clear wins are done.

## Size ideas to test in 1.4 (keep only what the numbers support)
- electron-builder `compression: "maximum"`; `electronLanguages` limited to the locales actually used.
- Check what goes into the package (no dev files, no source maps unless wanted, fonts subset).
- Differential updates already work; check how much the blockmap saves per release.

## Done when
A baseline report exists, each change is measured before/after with the same method, and only changes that help are
kept. Each improvement lands as its own small PR with its numbers in the description.
