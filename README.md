# Multi-Account Launcher for Claude

[![claude-launcher](https://github.com/histuan/Claude-Launcher/actions/workflows/claude-launcher.yml/badge.svg)](https://github.com/histuan/Claude-Launcher/actions/workflows/claude-launcher.yml)
[![Latest release](https://img.shields.io/github/v/release/histuan/Claude-Launcher?include_prereleases&filter=launcher-v*&label=release)](https://github.com/histuan/Claude-Launcher/releases)

A small Windows launcher that keeps several Claude accounts signed in at the same time, each one in its own
isolated instance of the official Claude desktop app. Pick an account, click, done. No more signing out and back in.

> **Status:** in development. See [`STATUS.md`](./STATUS.md) for progress, [`CHANGELOG.md`](./CHANGELOG.md) for the
> history of changes and [`docs/SCOPE.md`](./docs/SCOPE.md) for the full scope.

## Download

Get the latest installer (`Claude-Launcher-Setup-<version>.exe`) from the
[Releases page](https://github.com/histuan/Claude-Launcher/releases) (tags `launcher-v*`).
Pre-releases (`0.x`) are development builds.

The installer is not signed, so Windows SmartScreen will warn you: choose **More info → Run anyway**.
It installs per user and does not need administrator rights.

## How it works

The Claude desktop app is built on Electron, which accepts Chromium's `--user-data-dir` flag. Each account gets its own
profile folder, so logins, settings and caches never mix. The launcher always runs the real, installed Claude app;
it never copies or modifies it.

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
