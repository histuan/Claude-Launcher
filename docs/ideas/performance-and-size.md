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

## Deep study of the Claude desktop app
- How it starts with `--user-data-dir`, what the first start of an empty profile does (and how long it takes), how the
  single-instance lock behaves per profile, whether a profile can be pre-warmed safely.
- What changes between Claude updates (paths, process names) that could break the launcher; turn findings into
  checks in the diagnostics.

## Size ideas to test in 1.4 (keep only what the numbers support)
- electron-builder `compression: "maximum"`; `electronLanguages` limited to the locales actually used.
- Check what goes into the package (no dev files, no source maps unless wanted, fonts subset).
- Differential updates already work; check how much the blockmap saves per release.

## Done when
A baseline report exists, each change is measured before/after with the same method, and only changes that help are
kept. Each improvement lands as its own small PR with its numbers in the description.
