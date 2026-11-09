# Update progress window + "What's new" — planned 1.1.0

## Goal
After the person clicks **Install** on an update, the launcher closes and nothing is visible for ~20 seconds until
the new version opens by itself. Show something during that time, so it never looks like the app just vanished.

## How it works today (checked in the code, 2026-11-08)
- `src/main/selfUpdate.ts`: check → download (with %) → "Installing…" pause → `install()` = silent NSIS install,
  then the app quits; the installer opens the new version (`--updated`).
- If the person opens the launcher during the install, `updateInstalling()` in `src/main/main.ts` detects it and
  shows the "Finishing the update…" dialog (closes by itself after ~6 s) instead of opening the old version.
- So the information exists only if the person happens to open the app in those 20 s.

## Options (to decide after a small spike)
| Option | How | For | Against |
|---|---|---|---|
| A. NSIS progress page | Run the update installer **not** silent, with only the progress page, closing by itself on update runs (custom NSIS script via electron-builder; electron-updater `quitAndInstall(isSilent=false, isForceRunAfter=true)`) | Native, real progress, no extra process | Needs an NSIS script; today the Finish page asks for a click (the reason the update is silent) |
| B. Helper splash | Before quitting, start a tiny window **outside the install folder** (e.g. a PowerShell/WinForms script in `%LOCALAPPDATA%`) that shows "Updating…" with an indeterminate bar and closes when the installer process exits | Independent of NSIS | One more moving part; must never block the installer |
| C. Second Electron window | Not viable: the install folder is being replaced while it runs | — | File locks |

**Decided (2026-11-09): A.** It is tied to the install itself (cannot hang or close early) and shows real progress.
Style the NSIS page as far as it allows (icon, colours, texts). B only if A turns out impossible; say why in the PR.

## "What's new" = the full version history
Not just a note about the latest version: a scrollable **version history** of the whole project, so anyone can see
everything that was added (the best list of features is the list of what each version added).

```
┌──────────────────────────────────────────────┐
│  What's new                               ✕  │
│  [ Release notes on GitHub ] [ GitHub page ] │  top: two links, always visible
│                                              │
│  ▌ 1.1.0 · November 2026        ← current    │  bright, accent bar, opened here
│  ▌ • Greetings change with the time of day   │
│  ▌ • A progress window while updating        │
│                                              │
│    1.0.0 · November 2026                     │  dimmer: older versions
│    • First stable release                    │
│    0.7.0 · …                                 │
│    …                                         │
│    0.1.0 · October 2026          beta        │  versions < 1.0 tagged "beta"
└──────────────────────────────────────────────┘
```

- **When it opens:** by itself once, on the first start after an update (`--updated` or version changed), scrolled
  to the new version; any time from the version label (bottom-right) and from Settings → About. Today the version
  label opens the GitHub release page directly (`releasePageUrl` in `src/core/version.ts`); it will open this screen
  instead, and the GitHub page moves to the button below.
- **Two links at the top:** **Release notes on GitHub** opens the release page of the version being read
  (`releasePageUrl`, built from the version only); **GitHub page** opens the repository. Like the existing
  `launcher:openVersionNotes` and `launcher:update:openReleases` handlers in `src/main/main.ts`, each URL is fixed or
  built in the main process; the window never sends a URL.
- **Look:** the current version on top with full contrast and the accent bar; older versions below in the muted text
  colour, still readable; pre-1.0 versions with a small "beta" tag. Every version back to 0.1.0.
- **Source:** `CHANGELOG.md`, bundled with the app at build time, so it works offline and never fetches anything.
  Parsed by a tiny parser for the subset the changelog uses (version headings, dates, lists, bold, code); rendered as
  plain DOM text, never as raw HTML.
- **Words people understand:** the CHANGELOG is written for developers. Add a short **Highlights** list (1–3 plain
  lines) at the top of each version's section and show only the highlights in the app, with "Show details" to expand
  the full entry. Write highlights for the existing versions once (0.1.0 → 1.0.0).
- All interface texts in `strings.ts`; the changelog itself stays in English until the Português phase decides.

Tests: the parser reads every version in the real `CHANGELOG.md`; the current version is first and marked; versions
< 1.0 are tagged beta; a version without highlights falls back to its first lines; no HTML is injected.

## Measure first
Time each step on the PC (download, install, first start) before choosing (step 0 in `../IDEAS.md`); part of the
20 s may shrink with the size work in `performance-and-size.md`.

## Done when
From the click on **Install** to the new window, something is always on screen; works for full and differential
updates; tested on the PC by updating from the previous release (never by installing a PR artifact).
