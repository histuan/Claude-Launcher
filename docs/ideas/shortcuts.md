# Shortcuts and quality of life — planned 1.4.0 (Phase 11)

## Goal
Open the right account from anywhere in one step, and make the main screen faster to use every day.

## 1. `--open <card>` command line (the base)
- `Claude-Launcher.exe --open <card id>` opens that account (Main or extra) exactly as a click on its card would,
  without showing the launcher window, then quits.
- Ids, not labels, in shortcuts (labels change); unknown id → open the launcher normally and say the card no longer
  exists.
- Today `src/main/main.ts` has no single-instance lock (checked 2026-11-08). Decide in this phase: either `--open`
  runs as its own short process (simplest), or add `app.requestSingleInstanceLock()` and handle `second-instance`.
  Keep the update-installing check (`updateInstalling()`) in front of both.

## 2. Taskbar jump list
Right-click the launcher in the taskbar (or its Start menu entry) → the accounts appear as tasks →
`--open <id>`. `app.setUserTasks` (Windows), refreshed whenever cards change. Card name as title, e-mail hidden in
privacy mode.

## 3. Desktop shortcut per account
Card menu → **Create shortcut**: a `.lnk` on the desktop pointing to `Claude-Launcher.exe --open <id>`, with the
card's photo turned into an `.ico` when there is one (else the launcher icon). `shell.writeShortcutLink`.

## 4. Quick actions with `claude://` links
Claude Desktop answers `claude://` links: `claude://claude.ai/new` (new chat, optional `q=` prompt),
`claude://code/new`, `claude://cowork/new`, `claude://claude.ai/project/<id>`, `claude://claude.ai/chat/<id>`
(support article "Open Claude Desktop with a link").
- Card menu (and jump list sub-tasks): **New chat · New Code session · New Cowork task**.
- The catch: Windows sends a `claude://` link to whichever Claude the system registered, which may be the wrong
  account. **Phase 7 tests** whether passing the link as an argument to that profile's Claude
  (`claude.exe --user-data-dir=<profile> claude://claude.ai/new`) reaches that instance, both when it is closed and
  when it is already running. Ship this part only if it does, reliably.
- If Phase 7 also finds a link that opens the **usage** page, add a **Usage** quick action (the safe alternative to a
  usage meter: the launcher never reads the numbers).

## 5. Main screen quality of life
- **Keys 1–9** open the first nine cards (Enter on a focused card still works).
- **Drag to reorder** cards (mouse and keyboard: Alt+←/→ on a focused card); order saved in the config.
- **Accent colour per account**: a coloured ring on the avatar, picked from a small palette that passes contrast.
- **Hidden Claude windows**: when that account's Claude runs with no visible window, the card says
  "Running (hidden)" and offers **Show** / **Close**. Needs a safe way to find the window; Phase 7 checks.
- **Restart all accounts** (menu next to Add account): closes and reopens every running account, for when a Claude
  update waits for all windows to close (only if Phase 7 shows that happens).
- **Duplicate e-mail warning** when two cards use the same e-mail.
- Optional, only if the card stays clean: **last opened** ("2 h ago") and a one-line **note**; privacy mode hides
  the note.

## Tests
- `--open` with a valid id, an unknown id, and during an update install.
- Jump list and shortcut builders produce the expected arguments (pure functions, no Windows needed).
- Order and accent colour survive a restart; keys 1–9 map to the visible order.

## Done when
An account opens from the taskbar, from a desktop shortcut and from keys 1–9; quick actions open in the right
account (or are left out with the reason); cards can be reordered and coloured; hidden windows can be shown or closed.
