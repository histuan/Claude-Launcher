# Multi-Account Launcher for Claude

<p>
    <a href="https://github.com/histuan/Claude-Launcher/releases/latest/download/Claude-Launcher-Setup.exe"><img src="docs/badges/download.svg" alt="Download for Windows" height="38"></a><img src="https://github.com/histuan/Claude-Launcher/releases/latest/download/badge-download.svg" alt="Download the latest version for Windows" height="38"></a>
  <img src="docs/badges/windows.svg" alt="Windows 10 / 11" height="36">
  <a href="./LICENSE"><img src="docs/badges/license.svg" alt="MIT license" height="36"></a>
</p>

A small Windows launcher that keeps several Claude accounts signed in at the same time, each one in its own
isolated instance of the official Claude desktop app. Pick an account, click, done. No more signing out and back in.

> **Status:** in development. See [`docs/STATUS.md`](./docs/STATUS.md) for progress, [`CHANGELOG.md`](./CHANGELOG.md) for the
> history of changes and [`docs/SCOPE.md`](./docs/SCOPE.md) for the full scope.

## Download

Get the latest installer (`Claude-Launcher-Setup-<version>.exe`) from the
[Releases page](https://github.com/histuan/Claude-Launcher/releases) (tags `v*`; up to 0.4.5 `launcher-v*`).
Versions before 1.0.0 are still in development. Since 0.4.0 the launcher opens accounts and signs in extra
accounts by itself.

**Before your first sign-in from the launcher, back up your main Claude profile**: copy the folder
`%LOCALAPPDATA%\Claude-Data\claude_<id>` somewhere else (with Claude and Claude Code closed).

The installer is not signed, so Windows SmartScreen will warn you: choose **More info → Run anyway**.
It installs per user and does not need administrator rights.

Since 0.6.0 the launcher updates itself: when a newer release is out, it asks once per start (**Later** or
**Install**; nothing is forced). Older versions are updated by installing the new `.exe` by hand.

## For testers: installing a PR build

[![CI](https://github.com/histuan/Claude-Launcher/actions/workflows/claude-launcher.yml/badge.svg)](https://github.com/histuan/Claude-Launcher/actions/workflows/claude-launcher.yml)

Pull Request builds are not on the Releases page; each PR's Actions run has the installer as the artifact
**launcher-installer**. [`scripts/install-latest.ps1`](./scripts/install-latest.ps1) installs it in one step. Save it
(for example in `%USERPROFILE%\Claude-Launcher-tools\`) and run it in PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\Claude-Launcher-tools\install-latest.ps1"
```

What it does:

1. Takes the newest open PR (or the one given with `-Pr <number>`).
2. Takes the newest CI run of that PR's latest commit and stops with a message if it is still running or failed.
3. Downloads the `launcher-installer` artifact through [nightly.link](https://nightly.link), so no GitHub login is
   needed. nightly.link is a third-party service, not part of GitHub.
4. Closes the launcher if it is open, installs silently (`/S`) and opens it again.

With no open PR it installs the latest Release instead. `-DownloadOnly` only downloads: the installer is saved to
`%USERPROFILE%\Downloads` and the script prints its full path.

A PR build has the same version number as the release it becomes, so the self-update does not offer that release
again after the merge.

## How it works

The Claude desktop app is built on Electron, which accepts Chromium's `--user-data-dir` flag. Each account gets its own
profile folder, so logins, settings and caches never mix. The launcher always runs the real, installed Claude app;
it never copies or modifies it.

Signing in an extra account is the tricky part on Windows: the sign-in callback always goes to the default Claude
instance. So the launcher closes your main Claude, sets its profile folder aside (a rename, never a delete), opens a
blank Claude for you to sign in, moves that signed-in folder to the new account, and puts your main profile back.
If the launcher is interrupted, the next start offers to restore your main profile first.

## Planned features (v1)

- Greeting with your Windows name (editable)
- One card per account with label, email and account name
- Add, rename and remove accounts
- Windows only for now; macOS and Linux later

## License

[MIT](./LICENSE) © 2026 Thiago Uchoa Gomes. You can use, copy, change and share this code freely, including in
other projects, as long as the license notice stays with it. The bundled fonts keep their own license
(SIL Open Font License).

## Disclaimer

This is an independent project. It is not affiliated with, endorsed by, or supported by Anthropic.
"Claude" is a trademark of Anthropic.
