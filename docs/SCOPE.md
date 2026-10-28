# Scope — Multi-Account Launcher for Claude (v1, Windows)

## 1. What it is

A single-screen app that **adds** and **opens** Claude Desktop accounts. Each account runs in a separate
instance of the official app and stays signed in. Nothing more.

## 2. The screen

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│        ✳  Good evening, Thiago                       │  ← original icon + serif greeting
│                                                      │
│     ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│     │      ⋯   │  │      ⋯   │  │      ⋯   │         │  ← card menu
│     │  ( T )   │  │  ( W )   │  │  (photo) │         │  ← chosen photo or initial
│     │          │  │          │  │          │         │
│     │ Main     │  │ Work     │  │ College  │         │  ← name the person gave
│     │ thiago@… │  │ me@comp… │  │ t@unifor…│         │  ← email (light grey)
│     │ Thiago U.│  │ Thiago G.│  │ Thiago   │         │  ← real account name (smaller, greyer)
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

- Portrait rectangles (~160 × 200 px at 100 % scale; Windows scaling enlarges them), rounded corners (~16 px),
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
- **Change photo** — picks an image from the PC (png/jpg/webp), cropped to a circle; option "back to the initial".
- **Remove** — with confirmation. Deletes that account's profile folder. Not available on the Main card.
- **Close this account** — ends that account's Claude. The launcher **stays open** afterwards (intended: the person
  usually closes one account to do something else in the launcher).

**Signed-out state (tested on Thiago's PC, 0.4.2):** signing out inside Claude does **not** change the `config.json`
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
- No automatic updates in v1: new versions come out on GitHub Releases (tag `launcher-vX.Y.Z`), created automatically
  when a phase is merged into `main`.
- The `.exe` is not signed: the README explains SmartScreen ("More info → Run anyway") and Smart App Control.

## 6. Out of v1

macOS and Linux; light theme; migrating scheduled tasks and MCP between profiles; automatic account photo
(only once Claude desktop has a profile photo); per-account usage meter; automatic updates; other interface languages.

## 7. v1 done criteria

- Installs and opens on Thiago's Windows 10/11.
- Opens the Main account and at least one extra account side by side, each in its own account.
- Add account works with email sign-in and Google sign-in, and the main profile stays intact afterwards.
- Closing the launcher in the middle of sign-in and reopening it restores the main profile.
- Greeting, name editing, cards, ⋯ menu and the "● Running" indicator work as described above.
