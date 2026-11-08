# Ideas after v1.0 — index, review and roadmap

Not promises. Each idea picked up becomes its own issue and PR (or a phase, if it is big).
Reviewed 2026-11-08: every idea has a verdict, and ideas that do not pay off are kept at the end with the reason,
so they are not proposed again by accident.

## How the ideas are kept

| File | What it holds |
|---|---|
| `IDEAS.md` (this file) | Principles, the suggested order, the full list with a verdict per idea, and what was decided against. |
| `ideas/<topic>.md` | Ideas already thought through: goal, how it could work, risks, open questions, "done when". |
| `ideas/DONE.md` | Ideas that shipped, with the version and the PR. |

A new idea goes in the list first (one line, with a verdict); it gets its own file only when it is about to be planned.

## Principles (every idea is checked against these)

1. **Session data never leaves its profile.** The launcher never reads, copies, decrypts or uploads cookies or
   tokens. Anything that would need them is out.
2. **No telemetry, no server.** Nothing about the person or their use leaves the PC.
3. **For separate accounts, not for getting around limits.** Work and personal accounts side by side are normal;
   creating accounts to dodge plan limits is what Anthropic's usage policies target. The project never presents
   itself as a way around limits.
4. **Not affiliated with Anthropic**, and it looks like it: original icon and names, no Anthropic logo or mascot.
5. **Small and boring where it matters** (profiles, updates, deletions); playful only where it is harmless (greetings,
   easter eggs).

## Versioning (since 1.0.0)

Versions are `MAJOR.MINOR.PATCH`, three separate whole numbers (`src/core/version.ts` compares them that way):
- **MINOR** = a phase with new features: 1.1.0, 1.2.0 … 1.9.0, **1.10.0**, 1.11.0 … (1.10 comes after 1.9; there is no
  limit, so reaching 2.0 is a choice, never an accident).
- **PATCH** = fixes and small additions: 1.1.1, 1.1.2 …
- **MAJOR** = a deliberate big step (for example a redesign or sync). Decided, not counted.

Numbers are never read as decimals: 1.2.0 is **older** than 1.12.0, so a scheme like 1.1 → 1.11 → 1.12 → 1.2 would
make the self-update refuse to offer 1.2 to anyone on 1.12.

## Suggested order

| Phase | Version | What | Why at this point |
|---|---|---|---|
| 7 | — | Baseline measurements + research (deep links per profile, Claude updates with several instances open) | Cheap; tells where the time goes and what is possible before building. |
| 7.5 | 1.0.1 | Resilience against Claude updates: a signed-out card still opens, "unknown" is not "signed out", finish a sign-in by hand, exe from the package manifest, self-check after a Claude update, fixtures per Claude version | Claude updates itself often; today a renamed cookie would stop every extra account from opening. Protect what exists before adding more. |
| 8 | 1.1.0 | Varied greetings (with rare ones) + update progress window + version history ("What's new") | Small, visible, low risk. |
| 9 | 1.2.0 | Settings page + theme presets (Warm, Graphite, Light, System) + privacy mode + updates and "at login" settings + copy e-mail on sign-in | Theme and behaviour choices in one place; needed before any video. |
| 10 | 1.3.0 | Security review + community files | Before promoting the project. |
| 11 | 1.4.0 | Performance and size, using the baseline | Optimise the final shape. |
| 12 | 1.5.0 | Presentation: README, GIFs/videos, release notes format, small website, one community post | Shows everything above. |
| 13 | 1.6.0 | Shortcuts and quality of life: `--open` command line, taskbar jump list, desktop shortcut per account, quick actions (`claude://`), keys 1–9, drag to reorder, accent colour, hidden windows | High value per hour; builds on the Phase 7 research. |
| 14 | 1.7.0 | Português (Brasil) interface | Translate once the texts stop changing. |
| — | later | Claude Code profiles, copy MCP servers between accounts, sync folder | Bigger or less urgent. |

Small fixes ship as PATCH versions between phases (1.1.1, 1.1.2 …).

## The list

Verdict: ✅ worth it · ⚠️ worth it with the change noted · 💤 fine but not needed (no one is missing it) ·
🚫 not worth it (cost or risk higher than the gain) · ☠️ actively bad (see "Decided against").

### Greeting and fun
- ✅ **Varied greetings by time of day**, late-night set included — 1.1 — `ideas/greetings.md`
- ✅ **Rare greetings** (about 1 in 200 opens, a special line) — 1.1, nearly free once greetings vary — `ideas/greetings.md`
- 💤 Seasonal themes (holidays), local stats ("opened 120 times"), sounds

### Settings and themes
- ✅ **Settings page** — 1.2 — `ideas/settings-and-theme.md`
- ✅ **Theme presets**: Warm dark (default), Graphite dark (like the newer Claude look), Light, System — 1.2
- ✅ **Privacy mode** (hide e-mails and real names; needed for videos and screen sharing) — 1.2
- ✅ **Updates setting**: install automatically (on the next close) · ask me · off — 1.2
- ⚠️ **"At login"** instead of a plain "start with Windows": nothing · show the launcher · open account X. A launcher
  that closes after one click gains little from starting alone; opening a chosen account is the real use — 1.2
- ✅ **Copy the e-mail on sign-in** with a short "E-mail copied" message — 1.2
- ✅ **Ctrl+,** opens Settings; **Windows high-contrast mode** respected — 1.2
- ✅ **After opening an account**: close the launcher (today) · keep it open — 1.2
- ✅ **Export / Import launcher settings** (cards, names, photos; never session data) and **Reset launcher
  settings** — 1.2, also the manual version of sync
- ✅ **Languages**: Português (Brasil) after English — 1.7

### Updates and history
- ✅ **Something on screen during the ~20 s install** — 1.1 — `ideas/update-progress.md`
- ✅ **Version history in the app** (every version back to 0.1.0, current highlighted, beta tag before 1.0) with
  **"Release notes on GitHub"** and **"GitHub page"** buttons — 1.1 — `ideas/update-progress.md`
- ✅ **Plain-language Highlights** per version, reused for the release notes — 1.1
- ✅ **Compatibility notice**: when Claude Desktop updates to a version never tested with the launcher, say so calmly;
  the same data fills a **"Tested with Claude <version>"** line in the README and the diagnostics — 1.6 or a patch
- ✅ **Faster first start after install** (5.8 s measured; normal starts ~0.3–1 s) — 1.4
- ⚠️ **Smaller installer**: only cheap settings (compression, unused locales); Electron itself is most of the size, so
  expect tens of percent at best, not halves — 1.4
- ⚠️ **Faster sign-in window**: much of it is Claude's own start-up; measure first — 1.4
- 💤 Beta channel (pre-releases through the updater; needs version suffixes the updater rejects today)
- 💤 winget / Scoop distribution (only if people ask; SmartScreen stays the same)
- 🚫 Code signing for now (yearly cost; revisit with real users)

### Shortcuts and accounts
- ✅ **`--open <card>` command line**: the base for every shortcut below — 1.6 — `ideas/shortcuts.md`
- ✅ **Taskbar jump list**: right-click the launcher in the taskbar → open an account directly — 1.6
- ✅ **Desktop shortcut per account** ("Create shortcut" in the card menu) — 1.6
- ✅ **Quick actions per card** with Claude's `claude://` links: New chat · New Code session · New Cowork task.
  Needs the Phase 7 test that a link reaches the right profile — 1.6
- ✅ **Keys 1–9** open the first nine cards; **drag to reorder** cards — 1.6
- ✅ **Accent colour per account** (ring on the avatar) — 1.6
- ✅ **Hidden Claude windows**: "Running (hidden)" with Show / Close (a real problem: Claude keeps running hidden
  after its window closes on some PCs) — 1.6
- ✅ **"Restart all accounts"** to let a pending Claude update apply, if Phase 7 shows several open instances delay it — 1.6
- ⚠️ **"Usage" quick action**: the honest version of a usage meter. Opens that account's own usage page inside its
  Claude window, if Phase 7 finds a link that does it; the launcher never reads the numbers itself — 1.6, if possible
- ✅ **Duplicate e-mail warning** when a second card uses the same e-mail — any patch
- ⚠️ **Last opened** on the card ("2 h ago") — small, only if the card stays uncluttered
- ⚠️ **Card notes** (a short line like "client X") — small, privacy mode hides it
- ✅ **Claude Code profiles**: a card type that opens a terminal with Claude Code signed in to that account
  (`CLAUDE_CONFIG_DIR` per account, a documented mechanism) — later
- ⚠️ **Copy MCP servers from one account to another** (each profile has its own `claude_desktop_config.json`): show
  exactly what is copied, since entries can hold API keys; never log them — later
- ⚠️ **Same cards on every PC** through a sync folder (OneDrive / Google Drive); sign-ins never travel — later —
  `ideas/sync.md`
- 💤 Open several accounts at once / groups (heavy on memory, rarely needed), search box, compact list view
- 💤 Automatic account photo (only if Claude desktop ever exposes one)

### Quality, security, performance
- ✅ **Resilience against Claude updates** (top priority): a click always opens the account, signed-in detection
  that degrades to "unknown", "I'm signed in" button, exe from the package manifest, process and package fallbacks,
  self-check after a Claude update, fixtures per Claude version — 1.0.1 — `ideas/resilience.md`
- ✅ **Agent-run measurements on a real PC**: the AI agent runs commands and drives the screen, repeats each
  measurement dozens of times and records the timings (too tiring by hand) — Phase 7 and 1.4 —
  `ideas/performance-and-size.md`
- ✅ **Deep study of how the Claude desktop app behaves** (start-up per profile, single-instance lock, first start of a
  new profile, `claude://` links, how its updates apply) to find faster paths and new ways to connect — Phase 7
- ✅ **Bug-hunt round**: the agent uses the app on the PC like a person would (every menu, odd inputs, closing things
  at the wrong moment) and files what breaks — after 1.3, then before each MINOR release
- ✅ **Tech-debt review**: a short list of code worth simplifying, kept with the performance round — 1.4
- ✅ **Accessibility pass** in every UI phase: screen-reader names, keyboard-only use, reduced motion — ongoing
- ✅ **Visual polish pass**: spacing, alignment and states checked against the design rules once the settings and
  themes exist — with 1.2
- ✅ **Security review + community files** (SECURITY.md, issue templates, CONTRIBUTING, Discussions, Dependabot,
  CodeQL) — 1.3 — `ideas/security-review.md`
- ✅ **"Report a problem"** button: a pre-filled GitHub issue with the anonymised diagnostics — 1.3
- ✅ **Contrast test** for every theme preset — 1.2
- ✅ **README badge says "Windows 11"** until Windows 10 is really tested — 1.1 (small and honest)
- ✅ **CI**: confirm the `test` job after `ubuntu-latest` moves to Ubuntu 26 — any patch
- ✅ **Memory assistant review** (Phase 7) and a **1.1.x patch** with what it finds: pick the newest
  `claude-memory-*.zip` from Downloads by itself, open the import screen directly if a link exists, step texts that
  name both "Your Claude" and "Memory" (the menu was renamed; "Unified Claude" from 2026-11-10 may rename it again),
  a last "check the new entries" step; confirm a second "Start import" and ~100,000-character pastes; remove partial
  real names from diagnostics. Anthropic offers no account-to-account memory transfer, so this assistant stays the
  best route — `ideas/performance-and-size.md`
- 💤 End-to-end UI tests with screenshots (worth it only when the UI changes often or more people contribute)
- 💤 Windows 10 test on a real machine (needs one)

### Presentation and community
- ✅ **README overhaul with GIFs** (a GIF at the top is worth more than any page), nicer Releases page, repository
  topics and social preview — 1.5 — `ideas/presentation.md`
- ✅ **Demo videos** showing the app working in dark and light themes; the agent writes the storyboard and the
  recording checklist and cuts/compresses with ffmpeg; recording by hand looks better — 1.5
- ✅ **One helpful post** where people ask for this (the multi-account request on Anthropic's GitHub, a Claude
  community forum), clearly "not affiliated" — 1.5
- ✅ **Write-up of how it was built** (problem, design, testing, releases) for a blog or portfolio — any time
- ✅ **Small website** (HTML, CSS, a little JS; video, download button, open source link), on a host that browsers
  trust for downloads: check the domain is not flagged by Safe Browsing first, and use Vercel or Netlify if it is —
  1.5

### Platforms
- 💤 **macOS and Linux**: Claude Desktop exists on both now, but the launcher's core (MSIX paths, PowerShell,
  installer) is Windows-only, so a port is close to a rewrite of `src/main/system`. Only if people ask.

## Decided against (and why)

| Idea | Verdict | Why |
|---|---|---|
| Version scheme 1.1 → 1.11 → 1.12 → 1.2 | ☠️ | Versions are whole numbers per part: 1.2.0 < 1.12.0, so the updater would never offer 1.2. The PATCH number already gives "small steps" (1.1.1, 1.1.2). |
| Read e-mail/name from the `sessionKey` cookie | ☠️ | Breaks principle 1; decrypting browser cookies is exactly what password-stealing malware does, so antivirus tools may flag the launcher; breaks with Claude updates. |
| Own account system with login and a server | ☠️ | A server, passwords, data-protection law and uptime: bigger and riskier than the launcher itself. A sync folder gives the same result. |
| Per-account usage meter read by the launcher | ☠️ | Would need session tokens or scraping; no safe public source. The "Usage" quick action (open the account's own usage page) is the safe version. |
| Using Anthropic's logo or mascot anywhere | ☠️ | Not ours to use; makes the project look official. Original art only. |
| Easter-egg runner game | 💤 dropped | The point was Claude's own character, which cannot be used; with another character it is not worth it. |
| Portable (zip) version | 🚫 | No self-update, different paths for recovery and photos, more antivirus false alarms. The per-user installer needs no admin rights already. |
| Sign-out detection while Claude is open | 🚫 | The cookie database is locked while Claude runs; reading around the lock is fragile. Detection after closing works. |
| Moving scheduled tasks or Project memories | 🚫 | They live on Anthropic's servers with no public API; the memory assistant is the honest version. |
| Cleaning Claude's cache folders | 🚫 | Deleting inside a Claude profile risks breaking it for a few hundred MB. Showing the size is fine; deleting is not. |
| Backing up a profile folder to a zip | 🚫 | The zip would hold live session cookies: a file that is as good as being signed in. |
