# Ideas after v1.0 — index and roadmap

Not promises. Each idea picked up becomes its own issue and PR (or a phase, if it is big).
Updated 2026-11-08 (after v1.0.0).

## How the ideas are kept

| File | What it holds |
|---|---|
| `IDEAS.md` (this file) | The full list, one line each, plus the suggested order. Short on purpose. |
| `ideas/<topic>.md` | Ideas already thought through: goal, how it could work, risks, open questions, "done when". |
| `ideas/DONE.md` | Ideas that shipped, with the version and the PR. An idea moves there when it is released. |

A new idea goes in this list first (one line); it gets its own file only when it is about to be planned.

## Suggested order

| Step | Version | What | Why at this point |
|---|---|---|---|
| 0 | — | Baseline measurements (agent-run, read-only) | Cheap to take now; tells where the ~20 s update and the slow first start actually go, which shapes step 1. |
| 1 | 1.1.0 | Varied greetings + update progress window + "What's new" after an update | Small, visible, low risk. |
| 2 | 1.2.0 | Settings page + light theme + "follow the system" theme + privacy mode | Theme is a setting, so they ship together. Must come before videos and the website, so those show the final UI. |
| 3 | 1.3.0 | Security review round + community files | Before the project is promoted more widely. |
| 4 | 1.4.0 | Performance and size work, using the baseline | Optimise the final shape of the app, not one that is about to change. |
| 5 | 1.5.0 | Presentation: README, screenshots, demo videos (dark and light), small website | Last, because it shows everything above. |
| 6 | 1.6.0 | Português (Brasil) interface + language setting | The Settings page from 1.2 already has the selector; translating is easier once the texts stop changing. |
| 7 | later | Same cards on every PC (sync folder), taskbar jump list, Claude Code profiles, the rest of the list | Bigger or less urgent. |

One phase per session; the next one starts after the merge (same rule as v1).

## The list

Status: `idea` = one line only · `elaborated` = has its own file · `planned` = in the order above.

### Interface
- **Varied greetings by time of day** (late-night ones too, e.g. a "night owl" line) — planned 1.1 — `ideas/greetings.md`
- **Settings page** (theme, language, start with Windows, privacy mode, …) — planned 1.2 — `ideas/settings-and-theme.md`
- **Light theme + follow the Windows theme** — planned 1.2 — `ideas/settings-and-theme.md`
- **Theme presets**: Warm dark (default, today's look), Graphite dark (darker, like the newer Claude look), Light — planned 1.2 — `ideas/settings-and-theme.md`
- **Automatic updates setting**: install automatically · ask me · off — planned 1.2 — `ideas/settings-and-theme.md`
- **Privacy mode**: hide e-mails and real names on the cards (screen sharing, demo videos) — planned 1.2 — `ideas/settings-and-theme.md`
- **Copy the e-mail on sign-in**: when a card's account is not signed in and the person signs in from it, the e-mail goes to the clipboard with "E-mail copied — paste it on the sign-in screen" — idea — `ideas/sync.md`
- **Same cards on every PC (sync)**: cards, photos and settings follow the person through a sync folder (OneDrive / Google Drive); sign-ins never travel — idea, after 1.5 — `ideas/sync.md`
- **Settings shortcut**: Ctrl+, opens Settings — idea
- **Accent colour per account** (a coloured ring on the avatar), so accounts are told apart at a glance — idea
- **Drag to reorder cards** — idea
- **Keyboard shortcuts**: 1–9 open the first nine cards — idea
- **Open several accounts at once** ("Open all", or saved groups) — idea
- **Languages**: English and Português (Brasil) first, others on request; chosen in Settings or from Windows (all texts are already in `src/renderer/strings.ts`) — idea, right after 1.2 — `ideas/settings-and-theme.md`
- **Accessibility pass**: screen-reader labels, reduced motion, keyboard-only walkthrough — idea

### Updates and installer
- **Visible progress during the ~20 s silent install** — planned 1.1 — `ideas/update-progress.md`
- **"What's new" note on the first start after an update** — planned 1.1 — `ideas/update-progress.md`
- **Smaller installer** (~121 MB, mostly Electron) — planned 1.4 — `ideas/performance-and-size.md`
- **Faster first start after install** (5.8 s measured; normal starts ~0.3–1 s) and a faster sign-in window — planned 1.4 — `ideas/performance-and-size.md`
- **Sign the installer** (fewer SmartScreen warnings; then set `win.publisherName` so the self-update checks the signature). Costs money — idea
- **Distribution through winget or Scoop** — idea
- **"Tested with Claude <version>"** filled in automatically by CI or by the diagnostics — idea
- **Compatibility warning**: on start, notice that Claude desktop updated to a version never tested with the launcher and say so calmly — idea
- **Portable version** (zip, no installer) — idea

### Accounts and Claude
- **Claude Code profiles (terminal)**: a card type that opens a terminal with Claude Code signed in to that account (`CLAUDE_CONFIG_DIR` per account) — idea
- **Taskbar jump list**: right-click the launcher icon in the taskbar → open an account directly, without the launcher window — idea
- **Desktop shortcut per account** ("Create shortcut" in the card menu) — idea
- **Automatic e-mail and name detection** via the `sessionKey` cookie (`docs/WINDOWS.md` §5, option 2). Skipped in v1: reads session tokens, breaks with Claude updates — idea
- **Sign-out seen while Claude is open** (today only after the account is closed; the cookie database is locked while Claude runs) — idea
- **Hidden Claude windows**: "Running (hidden)" on the card, with "Show" / "Close" — idea
- **Automatic account photo**, once Claude desktop has a profile photo — idea
- **Per-account usage meter**, if Claude ever exposes usage safely — idea
- **Move more between accounts**: scheduled tasks, MCP servers, Project memories per Project — idea

### Memory assistant
- Confirm whether Claude accepts a second "Start import" right after the first, and whether a paste near 100,000 characters goes in at once — idea
- Remove partial real names from the diagnostics report (today only the full name) — idea

### Quality, security, performance
- **Baseline measurements** (start, first start, open account, sign-in, update, size, memory), agent-run on a real PC — planned step 0 — `ideas/performance-and-size.md`
- **Security review rounds** (best practices; the app barely talks to the network, but it handles session folders) — planned 1.3 — `ideas/security-review.md`
- **Deep study of how the Claude desktop app behaves** (start-up, single-instance lock, new-profile first start) to find faster paths — planned 1.4 — `ideas/performance-and-size.md`
- **"Report a problem" button**: opens a pre-filled GitHub issue with the (already anonymised) diagnostics — idea
- **End-to-end UI tests** (Playwright for Electron) with screenshot comparison in dark and light — idea
- **Contrast test**: a unit test that reads the theme variables and checks WCAG AA for every text/background pair — planned 1.2 — `ideas/settings-and-theme.md`
- **Windows 10 test** on a real machine (only Windows 11 was tested; the README badge still says "Windows 10 / 11") — idea
- **CI**: check the `test` job after `ubuntu-latest` moves to Ubuntu 26 — idea

### Community and presentation
- **Community files**: issue templates (bug / idea), `CONTRIBUTING.md`, `SECURITY.md`, code of conduct, GitHub Discussions for questions — planned 1.3 — `ideas/security-review.md`
- **README overhaul**, nicer Release notes, repo topics and social preview image — planned 1.5 — `ideas/presentation.md`
- **Demo videos / GIFs** showing dark and light themes — planned 1.5 — `ideas/presentation.md`
- **Small website** (static HTML/CSS + a little JS, GitHub Pages): video, download button, features, open source — planned 1.5 — `ideas/presentation.md`
- **Write-up of how the project was built** (a short case study: problem, design, testing, releases) for a blog or portfolio — idea

### Platforms
- **macOS and Linux** (`docs/SCOPE.md` §6) — idea
