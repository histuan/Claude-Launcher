The only place that touches Windows (PowerShell, processes, Claude folders). Everything is injectable so tests can use mocks.

- `windowsUser.ts` — Windows display name for the greeting (PowerShell, `Win32_UserAccount.FullName`).
- `updater.ts` — electron-updater (GitHub provider): check, download, silent install; the pending installer's path (0.6.2).
