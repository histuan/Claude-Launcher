# Multi-Account Launcher for Claude

[![claude-launcher](https://github.com/histuan/Claude-Launcher/actions/workflows/claude-launcher.yml/badge.svg)](https://github.com/histuan/Claude-Launcher/actions/workflows/claude-launcher.yml)
[![Latest release](https://img.shields.io/github/v/release/histuan/Claude-Launcher?filter=launcher-v*&label=release)](https://github.com/histuan/Claude-Launcher/releases)

A small Windows launcher that keeps several Claude accounts signed in at the same time, each one in its own
isolated instance of the official Claude desktop app. Pick an account, click, done. No more signing out and back in.

> **Status:** in development. See [`docs/STATUS.md`](./docs/STATUS.md) for progress, [`CHANGELOG.md`](./CHANGELOG.md) for the
> history of changes and [`docs/SCOPE.md`](./docs/SCOPE.md) for the full scope.

## Download

Get the latest installer (`Claude-Launcher-Setup-<version>.exe`) from the
[Releases page](https://github.com/histuan/Claude-Launcher/releases) (tags `launcher-v*`).
Versions before 1.0.0 are still in development. Since 0.4.0 the launcher opens accounts and signs in extra
accounts by itself.

**Before your first sign-in from the launcher, back up your main Claude profile**: copy the folder
`%LOCALAPPDATA%\Claude-Data\claude_<id>` somewhere else (with Claude and Claude Code closed).

The installer is not signed, so Windows SmartScreen will warn you: choose **More info → Run anyway**.
It installs per user and does not need administrator rights.

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

## Credits

- Original idea and macOS guide: [chadtimbl.in](https://chadtimbl.in/writings/claude-workflow-tips.html#multiple-accounts)
- Windows sign-in approach based on [Zoltak-Dev/ai-multi-instance](https://github.com/Zoltak-Dev/ai-multi-instance) (MIT)

## Disclaimer

This is an independent project. It is not affiliated with, endorsed by, or supported by Anthropic.
"Claude" is a trademark of Anthropic.
