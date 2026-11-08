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

Lean towards **A** if the NSIS script stays small; B as fallback.

## "What's new" (cheap, do it regardless)
On the first start after an update (`--updated` or version changed), show a small, dismissible note:
"Updated to 1.1.0" + 2–3 lines from the CHANGELOG section + link to the full notes. Shown once.

## Measure first
Time each step on the PC (download, install, first start) before choosing (step 0 in `../IDEAS.md`); part of the
20 s may shrink with the size work in `performance-and-size.md`.

## Done when
From the click on **Install** to the new window, something is always on screen; works for full and differential
updates; tested on the PC by updating from the previous release (never by installing a PR artifact).
