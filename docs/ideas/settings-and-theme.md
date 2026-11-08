# Settings page + light theme + follow the system — planned 1.2.0

## Goal
A Settings page where the person controls how the launcher behaves, and a light theme that can follow the Windows
theme automatically.

## Settings page
Opened by a gear button in the top-right corner (keyboard reachable). A second view, not a dialog; Esc or "Back"
returns to the cards. Changes apply at once and are saved in the launcher config.

| Setting | Options | Default | Notes |
|---|---|---|---|
| Theme | System · Light · Warm dark · Graphite dark | System (dark side = Warm dark) | See "Theme presets" below |
| Language | System · English · Português (· more later) | System | Only English exists today; see "Languages" below |
| Start with Windows | On · Off | Off | `app.setLoginItemSettings` |
| Updates | Install automatically · Ask me (today) · Off (manual check only) | Ask me | "Install automatically" downloads in the background and installs on the next close |
| After opening an account | Close the launcher · Keep it open | Close | Today it always closes |
| Privacy mode | On · Off | Off | Hides e-mails and real names on cards (screen sharing, demo videos); card names stay |
| Greeting | Varied · Classic only | Varied | Depends on `greetings.md` |
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

## Theme presets
The Claude desktop app moved from the warm brown-grey dark look to a darker, near-black one. Offer both:

| Preset | Look | Notes |
|---|---|---|
| **Warm dark** (default dark) | Today's palette (`#262624` background, `#30302e` cards) | Stays the default |
| **Graphite dark** | Darker, near-black, neutral greys, same coral accent | Inspired by the newer Claude look; exact values tuned on screen, original values (no copied assets) |
| **Light** | Warm light palette above | |

- Each preset is just another set of the same CSS variables (`:root[data-theme="…"]`), so adding one later costs a
  block of colours plus its contrast test.
- "System" picks Light or the chosen dark preset (Warm or Graphite) from the Windows setting.
- Label names are drafts; avoid names that suggest an official Claude theme.

## Languages
- Today all texts are in `src/renderer/strings.ts` (English). Split into one table per language with the same keys;
  a test checks that every language has every key and the same `{placeholders}`.
- Order: English, Português (Brasil), then others only if someone asks (Spanish is the natural third).
- "System" uses the Windows display language when it is available, else English.

## Open questions
- Should "Keep it open" also hide the window to the tray? (Probably no tray in 1.2.)
- Where does "Copy diagnostics" live today in the UI? Move it to About or keep both.

## Done when
All settings work and survive a restart; switching the Windows theme while the launcher is open switches it at once
(title bar included); every preset passes the contrast test; automatic updates install on the next close when
chosen; screenshots of each preset in `docs/screenshots/`.
