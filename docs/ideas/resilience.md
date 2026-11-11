# Resilience against Claude updates — done in 1.0.1 (Phase 7.5)

Built as below, with these decisions: the two signals are applied strictly (a sign-out inside Claude keeps its
`oauth:*` keys, so it shows as unknown); "Claude changed" = the cached exe no longer exists; the self-check runs
when Claude's version changed or while the last one failed, and notifies only a new failure; a finish by hand
counts any cookie write since the sign-in window opened, but an existing card's folder is replaced only by a profile
whose cookie files hold a session (else it stays and the sign-in Claude opens again); `--simulate-claude-change`
tests it on a PC without writing the config, with Add account, Sign in again, Remove and photos turned off.

## Goal
Claude Desktop updates itself often. An update must never stop the launcher from **opening** an account. Anything
the launcher reads from Claude can change; when it does, the launcher degrades (a status becomes "unknown", a notice
appears) instead of breaking.

## What is already robust (checked in the code, 2026-11-08)
- `Claude.exe` is found through `Get-AppxPackage` every time the cached path stops existing (the MSIX folder changes
  on every update) — `src/core/claudeApp.ts`, `src/main/system/claudeApp.ts`.
- The default profile is found four ways, nothing hard-coded — `src/main/system/claudeProfile.ts`.
- Claude's version is only logged, never used to decide anything (`claudeVersion` in `src/core/signIn.ts`).
- The sign-in copies the whole profile folder, so a change in **how tokens look** does not matter: the launcher never
  reads token values.

## Fragile points (what an update could break)
| # | Depends on | Where | If it changes |
|---|---|---|---|
| F1 | Cookie named `sessionKey` on `claude.ai` | `src/main/system/cookies.ts` | Every extra card shows "signed out", and **clicking a signed-out card starts a new sign-in instead of opening** (`src/renderer/app.ts`, `isSignedOut ? signIn : openAccount`). The worst case: the app stops opening accounts. |
| F2 | Account key names in `config.json` (`oauth:*`, `lastKnownAccountUuid`, `*Account*`) as the "sign-in finished" signal | `src/core/signIn.ts` | A new sign-in never finishes by itself (today: Wait longer / Cancel only). Already changed once between Claude 3.x and 4.4212. |
| F3 | Exe at `<InstallLocation>\app\Claude.exe` | `src/main/system/claudeApp.ts` | Claude "not found" although installed. |
| F4 | Process filter regex `\WindowsApps\Claude_*\app\Claude.exe` | `src/core/processes.ts` | "Running" indicator and closing accounts stop working. |
| F5 | Package name `Claude` from `Get-AppxPackage *Claude*` | both `claudeApp.ts` and `claudeProfile.ts` | Claude "not found" if the package is renamed. |
| F6 | Default profile folder `Claude-Data\claude_*` | `claudeProfile.ts`, `signIn.ts` (`SLOT`) | Sign-in cannot set the main profile aside. |
| F7 | Memory menu names in the assistant's steps | `strings.memories` | Wrong instructions (no breakage). |

## Guards to build
1. **Signed out never blocks opening (F1).** A click on any card opens that account; if it really is signed out,
   Claude shows its own sign-in screen. "Sign in again" moves to the card menu. This one change removes the worst case.
2. **"Unknown" is not "signed out" (F1).** If, after Claude's version changes, every extra card flips to signed out at
   once, treat detection as unsure: show no signed-out state, log it, mention it in the diagnostics.
3. **A second vote (F1, F2).** Use the account key names in `config.json` (names only, as today) as a second signal;
   when the two disagree, the state is unknown, never "signed out".
4. **Finish the sign-in by hand (F2).** Next to Wait longer / Cancel: **"I'm signed in"**, which finishes the snapshot
   as if the signal had arrived (after the same cookie-write wait).
5. **Exe from the package manifest (F3).** Read the `Executable` of the package's application from its manifest
   (`Get-AppxPackageManifest`); keep `app\Claude.exe` as the fallback.
6. **Process filter from the real exe (F4).** Match processes against the folder of the exe actually found, with the
   regex as the fallback.
7. **Package match with a fallback (F5).** `Name = Claude`, else a package whose publisher is Anthropic and whose
   manifest declares a `Claude.exe`.
8. **No version gating, written down.** A test asserts no behaviour depends on Claude's version string.
9. **Self-check after a Claude update.** When Claude's version differs from the last start, run the quick checks
   (exe, default profile, cookie database readable, process query, sign-in signal names present) in the background;
   result in the diagnostics; a calm notice only if something failed ("A Claude update changed something; opening
   accounts still works"). Never blocks the cards.
10. **Fixtures per Claude version.** `test/fixtures/claude-<version>/`: `Get-AppxPackage` JSON, process command lines,
    `config.json` key-name lists, the cookie table's column names — names and shapes only, never values. Parsers run
    against every stored version, so a fix for a new Claude never breaks an older one.

## Open question for Phase 7
Can a GitHub Actions Windows runner install Claude Desktop (e.g. with winget) to run the no-account checks of guard 9
every week and open an issue when one fails? If not, the self-check on a real PC (where Claude updates itself) is the
early warning.

## Tests
- Card click opens the account in every sign-in state; "Sign in again" only from the menu.
- All-cards-flip detection marks the state unknown; a single card flipping stays "signed out".
- Manifest parsing, process matching and package fallback against the fixtures; the fallbacks are used when the
  primary answer is missing.

## Done when
With the cookie check forced to fail, every account still opens; the self-check reports which assumption broke;
fixtures exist for the Claude version on the PC.
