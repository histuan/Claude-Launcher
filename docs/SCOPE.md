# Scope — Multi-Account Launcher for Claude (v1, Windows)

## 1. What it is

A single-screen app that **adds** and **opens** Claude Desktop accounts. Each account runs in a separate
instance of the official app and stays signed in. Nothing more.

## 2. The screen

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│        ✳  Good evening, Alex                         │  ← original icon + serif greeting
│                                                      │
│     ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│     │      ⋯   │  │      ⋯   │  │      ⋯   │         │  ← card menu
│     │  ( A )   │  │  ( W )   │  │  (photo) │         │  ← chosen photo or initial
│     │          │  │          │  │          │         │
│     │ Main     │  │ Work     │  │ College  │         │  ← name the person gave
│     │ alex@ex… │  │ me@comp… │  │ a@school…│         │  ← email (light grey)
│     │ Alex R.  │  │ Alex M.  │  │ Alex     │         │  ← real account name (smaller, greyer)
│     │ ● Running│  │          │  │          │         │  ← only if the instance is running
│     └──────────┘  └──────────┘  └──────────┘  →      │  ← scrolls sideways only if it does not fit
│                                                      │
│                 [ + Add account ]                    │
└──────────────────────────────────────────────────────┘
```

All interface texts live in `src/renderer/strings.ts` (English in v1), so other languages can be added later.

### 2.1 Greeting

- "Good morning" from 5:00 to 11:59, "Good afternoon" from 12:00 to 17:59, "Good evening" from 18:00 to 4:59 (local time).
  Updates by itself if the app stays open across the boundary.
- Default name: first word of the Windows **display name** (`Win32_UserAccount.FullName`), without stray punctuation.
  If empty, use `USERNAME`. Real example from Phase 0: `FullName` = `"histuan ."` → `histuan`.
- **Editing:** hovering **only over the name** (not over "Good evening,") shows a ✏️ right after it.
  Clicking the name or the pencil turns the name into a text field. Enter saves, Esc cancels, an empty field restores the default.
  The edited name is saved and replaces the Windows name.

### 2.2 Cards

- Portrait rectangles (~160 × 216 px at 100 % scale since 0.5.0; Windows scaling enlarges them), rounded corners (~16 px),
  ~20 px gap between them. Content vertically centred.
- Top: round avatar (~64 px), centred. Photo chosen by the person or, if none, the initial of the card name.
- Below, in this order: **card name** (larger), **email** (light grey), **real account name** (smaller, fainter grey).
  Long text is cut with an ellipsis and shows the full text in a tooltip.
- "● Running" indicator when that account's instance is running.
- Hover: subtle highlight (border or background in the accent colour). Visible keyboard focus (Tab; Enter opens).
- The **first card is always the "Main" account**: the default Claude profile (no `--user-data-dir`). It cannot be removed.
  It shows a small fixed **"Main"** badge that stays even if the card is renamed (0.4.3).
- "● Running" means the account's **Claude process is open**, not that the account is signed in.
- The launcher's version (e.g. `v0.4.3`) is shown as small muted text in the bottom-left corner of the window.
- Single row of cards. Horizontal scrolling only when they do not fit in the window.

### 2.3 Card ⋯ menu

- **Rename** — changes the card name.
- **Edit details** — the account's e-mail (required) and real name (optional), typed by the person (every card,
  Main included). **Add account** asks for them too (`docs/WINDOWS.md` §5).
- **Change photo** — picks an image from the PC (png/jpg/webp), cropped to a circle; option "back to the initial".
- **Remove** — with confirmation. Deletes that account's profile folder. Not available on the Main card.
- **Receive memories from…** — guided copy and paste of the memories of another signed-in account into this one
  (`docs/PHASES.md`, Phase 5.1). The text stays only in the launcher's memory and is cleared on Done or Cancel.
- **Close this account** — ends that account's Claude. The launcher **stays open** afterwards (intended: the person
  usually closes one account to do something else in the launcher).

**Signed-out state (tested on Windows 11, 0.4.2):** signing out inside Claude does **not** change the `config.json`
keys, and the cookie database is locked while Claude runs, so a signed-out account is only known once its profile is
closed ("Not signed in" then appears on the card). The launcher does not try to detect it while the account runs.
Confirmed again in the 0.4.5 test: every copy of the cookie database fails with `EBUSY` while Claude runs, and for a
few seconds after "Close this account"; the card says "Checking…" meanwhile (up to ~10 s), then updates.

## 3. Look

| Item | Definition |
|---|---|
| Theme | Dark in v1 (light theme is out of scope) |
| Background | Warm dark, in Claude's tone (≈ `#262624`) |
| Card surface | Slightly lighter than the background (≈ `#30302e`) |
| Accent | Coral (≈ `#D97757`) on the icon, hover, focus and button |
| Text | Light cream (≈ `#F5F4EE`); email ≈ `#B7B5AD`; real name ≈ `#8F8D86` |
| Font | Free serif for the greeting and names (e.g. Source Serif 4); sans-serif elsewhere (e.g. Inter) |
| Icon | Original, inspired by a spark/asterisk. **Not** the Anthropic logo |
| Window | ~900 × 600, resizable (minimum ~720 × 480); dark title bar (`titleBarOverlay` with the theme colours) |

Values marked "≈" are approximate: keep them as CSS variables in one place to adjust later.

## 4. Behaviour

1. **Clicking a card** opens that account. If it is already open, Claude just brings its window to the front
   (behaviour verified in Phase 0). After opening, the launcher **closes by itself**.
2. **Add account**:
   1. the person names the card;
   2. the launcher warns that it will close the main Claude during sign-in and asks for confirmation;
   3. runs the snapshot sign-in flow (`WINDOWS.md`, section 4);
   4. detects the account email and name (`WINDOWS.md`, section 5); if that fails, asks the person to type the email;
   5. reopens the main Claude and shows the new card.
3. **Recovery:** if the launcher closes in the middle of a sign-in, on the next start it detects this and restores the main
   profile before anything else.
4. **Claude not installed** or old (non-MSIX) install: clear on-screen message, no technical error.
5. **Security:** session tokens never leave the PC and never go to logs.

## 5. Installation and updates

- Per-user NSIS installer, with a Start menu shortcut.
- New versions come out on GitHub Releases (tag `vX.Y.Z`; `launcher-vX.Y.Z` up to 0.4.5), created automatically
  when a phase is merged into `main`, with `latest.yml` and the `.blockmap` next to the `.exe`.
- **Self-update (since 0.6.0, scope change):** `electron-updater`, GitHub provider (public repo, no
  token in the app). Once per start, after the cards are shown (never blocking them), the launcher checks the latest
  release. A newer one shows "Version X is available. Install now?" with **What's new** (release page), **Later**
  (asked again on the next start) and **Install** (download with a progress bar, silent install, the launcher opens
  again). Errors show a short message with a link to the Releases page; nothing is ever forced. Never checks or
  installs while a sign-in or the memory assistant is in progress. Logs only versions and timings.
- The `.exe` is not signed: the README explains SmartScreen ("More info → Run anyway") and Smart App Control.

## 6. Out of v1

macOS and Linux; light theme; migrating scheduled tasks and MCP between profiles; automatic account photo
(only once Claude desktop has a profile photo); per-account usage meter; other interface languages. (Self-update moved into v1 in Phase 5.2.)

## 7. v1 done criteria

Reviewed for 1.0.0 (2026-11-07), on Claude Desktop 4.23118.0.0:

- ✅ Installs and opens on Windows 11. Windows 10 not tested.
- ✅ Opens the Main account and at least one extra account side by side, each in its own account.
- ✅ Add account works with e-mail sign-in, and the main profile stays intact afterwards. Google sign-in is
  supported: it happens in the same Claude window and ends with the same session cookies as the e-mail sign-in.
- ✅ Closing the launcher in the middle of sign-in and reopening it restores the main profile (tested several times).
- ✅ Greeting, name editing, cards, ⋯ menu and the "● Running" indicator work as described above.

### Scope changes since the plan

- **Self-update** (0.6.0): moved into v1 (§5).
- **Receive memories from…** (0.5.1): a guided assistant to copy Claude's memories between accounts.
- **E-mail and name typed by the person** (0.5.0): not detected automatically (`docs/WINDOWS.md` §5).
- **Account photo** (0.5.0): chosen by the person, the initial by default.
- **Copy diagnostics** (0.7.0): a report for bug reports, with nothing personal in it.
