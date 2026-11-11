# Status

**Current state:** **v1.0.1 released** (2026-11-10, PR #57): resilience against Claude updates. Works on Windows 10
and 11 (Windows 10 confirmed by users); e-mail and Google sign-in both tested. Next: Phase 8 in
[`PHASES.md`](./PHASES.md) → "After v1.0". Ideas, verdicts and what was decided against: [`IDEAS.md`](./IDEAS.md).

What each version changed: [`CHANGELOG.md`](../CHANGELOG.md). How the work is done and reviewed:
[`DEVELOPMENT.md`](./DEVELOPMENT.md).

## Missing

- Post-v1 work: Phases 8–15 (issues #32–#38 and #56, milestone "Multi-Account Launcher v1.x").
- Phase 7 leftovers (need eyes on Claude's own window or real accounts, `docs/perf/README.md` → "Not measured"):
  whether `claude://claude.ai/new` shows a new chat (it reaches the right account); the memory menu labels in English
  and Portuguese (screenshot, again after 2026-11-10); the memory assistant walk up to (not including) Confirm;
  Claude's update with extra accounts open (at the next Claude update).

## Notes for the next phases

- Self-update: a failed check is never shown, only logged (`update: check failed`).
- `scripts/install-latest.ps1` is the tester script (README → "For testers").
- Unsigned `.exe`: electron-updater verifies the signature only when `publisherName` is set (it is not), so unsigned
  updates install. If the installer is ever signed, set `win.publisherName` at the same time.

- E-mail and real name are typed by the person (`docs/WINDOWS.md` §5). Reading them via the `sessionKey` cookie was
  decided against on 2026-11-08 (`docs/IDEAS.md` → "Decided against"): the launcher never reads session values.
- Startup (0.5.1): only the very first start (no cache yet) waits for the Windows name and main-profile lookups.
- Memories: the menu paths are a translation of the Portuguese UI (Configurações → Memória → Exportar /
  Iniciar importação). If the English UI words them differently, only `strings.memories` changes. Export layout
  (PC test): `claude-memory-<date>/<memory path>.md`, 41 files and 131,248 characters on a real account.
- Not verified: whether Claude's Start import accepts a second import right after the first (the parts flow assumes
  it does), and whether a paste near 100,000 characters goes through in one go.
- Not verified on the PC yet: the window query (`Get-Process` `MainWindowHandle` joined to `Win32_Process` by id),
  now also used to decide whether the main Claude is reopened after a sign-in.
- `launchClaude` uses `windowsHide: true` (CLAUDE.md rule 7). libuv also applies it to GUI windows (`SW_HIDE` in
  `STARTUPINFO`); if Claude's window does not appear when opened from the launcher, this is the first suspect.
- Old (non-MSIX) install: it opens, but the "Running" indicator and sign-in only support the MSIX package.

## Decisions

- Electron + TypeScript; `.exe` only through GitHub Actions; one PR per phase, release on merge.
- Own repository (`histuan/Claude-Launcher`), project at the root. The PR template is `.github/pull_request_template.md`.
- Extra accounts sign in by snapshot of the default profile, with stash and restore.
- E-mail and name typed by the person; photo chosen by the person, initial by default.
- Original icon and free serif font (no logo and no official Claude font).
- Dark theme only in v1; the launcher closes by itself after opening an account.
- TypeScript with plain `tsc` (no bundler); a small `scripts/copy-assets.ts` copies the renderer's HTML/CSS into `out/`.
- `src/core` returns language-neutral keys (e.g. `greetingFor()` → `'morning'`); texts come from `strings.ts`.
- Config: Main is the account with `profileDir: null`, always first, never removed; its `label` is `null` until renamed
  (shows `strings.mainAccount`). Other accounts: `profileDir` = `%USERPROFILE%\ClaudeProfiles\<id>` (from the env var).
  Names are trimmed and capped at 40 characters. An unreadable config is renamed to `config.json.corrupt-<time>`.
- Greeting name: Enter **or leaving the field** saves, Esc cancels, empty restores the Windows name.
- Fonts: `@fontsource-variable/source-serif-4` and `@fontsource-variable/inter` (variable weight), copied with their
  OFL licenses into `out/` by `scripts/copy-assets.ts`.
- Icon: `npm run icon` renders `build/icon.svg` with Playwright (not a project dependency) into `build/icon.ico`.
- Profile ids come from the card name (ASCII slug, e.g. "Trabalho Ágil" → `trabalho-agil`), unique, never a Windows
  device name nor a folder that already exists; the folder name is the id. The launcher only creates or deletes folders
  directly inside `%USERPROFILE%\ClaudeProfiles` (`isLauncherProfileDir`).
- Process filtering by exe path is done in `src/core/processes.ts` (tested); PowerShell only lists `claude.exe`.
- Card size: CSS px already follow Windows scaling, so sizes are set for 100 % (160 × 200 shows as 240 × 300 at 150 %). 0.5.0: 160 × 216, for e-mail + name above the Main badge.
- Releases: regular and marked as latest since 0.3.0.
- Sign-in (0.4.4): the default Claude is asked to close (`taskkill /PID <pid> /T`, no `/F`), its exit is checked every
  ~250 ms (`process.kill(pid, 0)`), and after ~1 s what is left of the default profile is force-ended
  (`taskkill /T /F`, as ai-multi-instance does); a default-profile pid that was not there at the start = "reopened",
  stop at once and never end it. Finishing: after the keys appear, the launcher waits for the `Network\Cookies`
  write (stat only, max ~45 s, then Wait longer / Cancel), ~1 s more, then force-ends the sign-in Claude (the close
  request never works). A failed
  process query counts as "still running" (abort), never as "closed". The main Claude is reopened at the end only if it
  had a visible window before (0.5.0; running hidden or not running = left closed; cancel and success alike); after a success the new account opens too.
  "Session saved" (inside the sign-in, blank profile) = the text `sessionKey` in the cookie database files.
- "Signed in" for a card (0.4.5) = a claude.ai `sessionKey` row in `<profile>\Network\Cookies`, not expired and not
  empty (queried with the built-in `node:sqlite` on a temporary copy with its `-journal` / `-wal`; names, hosts,
  expiry and value lengths only, never values; copy deleted). The `oauth:tokenCache*` keys never decide (they stay
  after a sign-out). A running account keeps its last known state: a sign-out inside Claude is only seen after the
  account is closed (`docs/WINDOWS.md` §1, §4). A plain cookie text search is not enough: SQLite keeps a deleted
  row's text in free pages after a sign-out.
- Opening an account waits up to ~8 s for that profile's visible window (spawns once more after ~3 s); the launcher
  closes only then. "Close this account" / "Close and remove" end only that profile's main processes
  (`taskkill /T /F`): Main = no `--user-data-dir`, extra = its own `--user-data-dir`.
  Minimum free space 500 MB on the drive of the default profile. The Add card is created only when the sign-in succeeds.

## How to test

1.0.1 (resilience, Phase 7.5). Install 1.0.1 from the Releases page over 1.0.0 (or let the self-update do it).
Accounts, names and photos stay. Close the launcher between steps.

1. **Normal start.** Every card opens with one click, also one that shows **Not signed in** (Claude shows its own
   sign-in there). The ⋯ menu of every extra account has **Sign in again**; Main has none. The log
   (`%APPDATA%\claude-launcher\sign-in-timings.log`) has `self-check after Claude 5.1231.0.0: ok: … ms` on the first
   start (it runs once), and not on the next start. No notice appears.
2. **Copy diagnostics** → paste: a `Claude check: ok (Claude …)` line; card states as before.
3. **Forced failure** (nothing is saved to the config in this mode). In PowerShell:
   `& "$env:LOCALAPPDATA\Programs\Multi-Account Launcher for Claude\Multi-Account Launcher for Claude.exe" --simulate-claude-change`
   - No card shows **Not signed in**; every card still opens (try each one, closing Claude in between if you like).
   - **Add account**, **Sign in again**, **Remove** and **Change photo** are greyed; hovering says why (test mode).
   - A calm notice: "A Claude update changed something" / "Opening accounts still works…". OK closes it.
   - **Copy diagnostics**: `Claude check: failed: accountKeys (Claude …)`, `Simulated Claude change: yes`, extra
     accounts `unknown` (or `checking` if one was just closed). The log: `startup: --simulate-claude-change …`,
     `card check …: … -> unknown …`, `self-check … (simulated change): failed: accountKeys`.
4. **Back to normal:** start the launcher the usual way: no notice, cards as in step 1, and Copy diagnostics shows
   `Claude check: ok` again (the simulation saved nothing).
5. Optional, **sign-in by hand**: Add account, sign in in the Claude window, press **I've signed in** before the
   automatic step; if it says "No sign-in found yet", the button turns into **I'm signed in** and finishes it.
6. Optional, **Sign in again keeps a working account**: on a signed-in extra card, ⋯ → **Sign in again**, do NOT sign
   in, press **I've signed in**, then **I'm signed in**: "The sign-in was not saved yet" and the Claude window opens
   again. **Cancel**: the card still opens signed in.
