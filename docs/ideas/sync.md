# Same cards on every PC (sync) — idea, after 1.5

## Goal
Someone with a desktop and a laptop sees the same cards on both: card names, e-mails, account names, photos, order
and settings. The Claude sign-ins do **not** travel (they cannot and must not): each PC still signs in once per
account. A card that exists on this PC but is not signed in yet shows that clearly.

## What travels and what never does
| Travels | Never travels |
|---|---|
| Card name, e-mail, account name, photo, order, accent colour | Session cookies, tokens, profile folders |
| Launcher settings (theme, language, greeting, …) | Anything from the Claude profile itself |

## Options
| Option | How | For | Against |
|---|---|---|---|
| A. Sync folder | Setting "Sync folder": the launcher keeps `launcher-sync.json` + photos in a folder the person already syncs (OneDrive, Google Drive, Dropbox) and merges changes on start and on save | No server, no login, no cost, nothing new to secure; works offline | Depends on a sync app; simple merge rules needed (last change per card wins) |
| B. GitHub Gist | Sign in with GitHub; data in a private gist | No own server | GitHub account required; token storage |
| C. Own account system | Login (e-mail or a simple account) and a small server | Feels like a real product | Server, costs, security, password resets, privacy law (LGPD/GDPR), uptime: much bigger than the launcher itself |

Recommended: **A first**. It gives the "same cards everywhere" result with almost no risk. Revisit C only if the
project grows to many users who ask for it. Export/Import (Phase 9 settings) is the manual version of this and comes
first anyway.

## Signed-out cards on a new PC
- The card shows "Not signed in on this PC" and a **Sign in** action that runs the normal Add-account flow for that
  card (keeping its name, photo and e-mail).
- On that flow, the e-mail is copied to the clipboard with a short message: "E-mail copied — paste it on the sign-in
  screen". (Useful on its own, also without sync: see `../IDEAS.md`.)

## Open questions
- Merge rules: per card by id, newest change wins; deletions kept as tombstones so a removed card does not come back.
- Photos: copy the resized PNGs (`userData/photos/<id>.png`) next to the sync file.
- What if two PCs edit the same card offline? Newest wins, and the other version is kept in a backup file.

## Done when
Two PCs pointing at the same sync folder show the same cards and settings within one start, no session data ever
appears in the sync folder (test), and a card missing its sign-in on one PC can be signed in from its card.
