# Settings page + light theme + follow the system — planned 1.2.0

## Goal
A Settings page where the person controls how the launcher behaves, and a light theme that can follow the Windows
theme automatically.

## Settings page
Opened by a gear button in the top-right corner (keyboard reachable). A second view, not a dialog; Esc or "Back"
returns to the cards. Changes apply at once and are saved in the launcher config.

| Setting | Options | Default | Notes |
|---|---|---|---|
| Theme | System · Light · Dark | System | See below |
| Language | System · English (· Português when ready) | System | Only English exists today |
| Start with Windows | On · Off | Off | `app.setLoginItemSettings` |
| After opening an account | Close the launcher · Keep it open | Close | Today it always closes |
| Privacy mode | On · Off | Off | Hides e-mails and real names on cards (screen sharing, demo videos); card names stay |
| Greeting | Varied · Classic only | Varied | Depends on `greetings.md` |
| Check for updates on start | On · Off | On | The manual check stays available |
| Backup | Export / Import launcher settings | — | Cards, names, photos. **Never** session data or profile folders |
| About | Version, links (repository, changelog), Copy diagnostics, Open log folder | — | |
| Reset launcher settings | Button with confirmation | — | Does not touch any Claude profile |

Config: bump the config `version` with a migration that fills defaults; tests for the migration.

## Light theme + follow the system
- Today every colour is a CSS variable in `src/renderer/styles.css` (`:root`), and the window title bar repeats
  `--bg` / `--text` in `src/main/main.ts` (`titleBarOverlay`).
- Add a light set of variables under `:root[data-theme="light"]`; the main process decides the theme from the setting
  and `nativeTheme.shouldUseDarkColors`, listens to `nativeTheme.on('updated')`, tells the renderer, and calls
  `setTitleBarOverlay` with the new colours.
- First draft of the light palette (warm, same family as the dark one; to be tuned): background ≈ `#faf9f5`,
  surface ≈ `#ffffff`, surface hover ≈ `#f0eee6`, border ≈ `#e5e3da`, text ≈ `#1f1e1d`, e-mail ≈ `#5e5d59`,
  real name ≈ `#73726c`, accent ≈ `#c96442` (accent **text** likely needs a darker shade for 4.5:1).
- Contrast test: a unit test that reads both variable sets and checks WCAG AA (4.5:1) for every text/background pair
  used in the UI, so future colour tweaks cannot break contrast silently.
- Native dialogs already follow the system theme.

## Open questions
- Should "Keep it open" also hide the window to the tray? (Probably no tray in 1.2.)
- Where does "Copy diagnostics" live today in the UI? Move it to About or keep both.

## Done when
All settings work and survive a restart; switching the Windows theme while the launcher is open switches it at once
(title bar included); both themes pass the contrast test; screenshots of both themes in `docs/screenshots/`.
