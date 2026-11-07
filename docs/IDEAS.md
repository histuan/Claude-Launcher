# Ideas after v1.0

Not planned and not promised. Each idea picked up becomes its own issue and PR.

## From the v1 scope (`docs/SCOPE.md` §6)

- macOS and Linux.
- Light theme.
- Migrating scheduled tasks and MCP servers between profiles.
- Automatic account photo (only once Claude desktop has a profile photo).
- Per-account usage meter.
- Other interface languages (all texts are already in `src/renderer/strings.ts`).

## From the v1 work (`docs/STATUS.md`)

- Read the e-mail and account name from claude.ai (via the `sessionKey` cookie) instead of typing them.
- Sign the installer (then set `win.publisherName` too, so the self-update checks the signature).
