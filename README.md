# Multiconta para Claude

A small Windows launcher that keeps several Claude accounts signed in at the same time, each one in its own
isolated instance of the official Claude desktop app. Pick an account, click, done. No more signing out and back in.

> **Status:** in development. See [`ESTADO.md`](./ESTADO.md) for progress and [`docs/ESCOPO.md`](./docs/ESCOPO.md) for the full scope (in Portuguese).

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
