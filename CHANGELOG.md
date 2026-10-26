# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Releases are tagged `launcher-vX.Y.Z`.

## [Unreleased]

## [0.2.0] - 2026-10-26

Phase 2: the real screen, with sample accounts. Opening accounts arrives in 0.3.0.

### Added

- Launcher screen: greeting by time of day with the Windows display name (first word, stray punctuation removed,
  `USERNAME` as fallback); hovering the name shows a pencil and the name can be edited (Enter or leaving the field
  saves, Esc cancels, empty restores the Windows name).
- Account cards in a single row with horizontal scrolling: initial avatar, card name, email and real name (cut with an
  ellipsis, full text in a tooltip), hover and keyboard focus. The Main card (default Claude profile) is always first.
- Card ⋯ menu: **Rename** and **Remove** (with confirmation; not on Main) save to the launcher config;
  **Change photo** is shown but not available yet. The **Add account** button is visual only.
- Launcher config `config.json` in the app's `userData` folder (`{ version, greetingName, accounts }`), written
  atomically; an unreadable file is kept aside as `config.json.corrupt-<time>`. The first run adds two sample
  accounts (`demo-*`) so the screen can be tried.
- Original icon (two four-point sparkles) for the app, the installer and the greeting; `npm run icon` regenerates
  `build/icon.ico` from `build/icon.svg`.
- Bundled OFL fonts (Source Serif 4 and Inter, variable) via `@fontsource-variable`; theme colours and sizes as CSS
  variables in one place; dark title bar (`titleBarOverlay`); window 900 × 600, minimum 720 × 480.
- Tests: display-name cleanup, config rules (Main first, rename, remove), config file read/write, Windows name with a
  mocked PowerShell.

### Changed

- Phase 1.6: the project now lives in its own repository, `histuan/Claude-Launcher`, at the repo root.
- CI: the workflow runs on every pull request and push to `main` (no path filters) from the repo root; artifact and
  npm cache paths updated. Release on merge unchanged.
- PR template moved to `.github/pull_request_template.md`, so GitHub pre-fills it.
- `CLAUDE.md`, `docs/PHASES.md`, `README.md` (badges and links) and `STATUS.md` point to the new repository.
- `STATUS.md` moved to `docs/STATUS.md`; references in `CLAUDE.md`, `docs/PHASES.md` (prompt template included) and
  `README.md` updated.

### Fixed

- Restored the CI workflow (`.github/workflows/claude-launcher.yml`), deleted by mistake after the 0.1.0 merge.

## [0.1.0] - 2026-10-26

First pre-release: the project skeleton (Phase 1) plus the GitHub process and English rename (Phase 1.5).

### Added

- Electron app with a placeholder window, `src/` layout, greeting rule with tests (`node:test`).
- Per-user NSIS installer (`Claude-Launcher-Setup-<version>.exe`) built by GitHub Actions on `windows-latest`.
- Automatic pre-release on merge to `main`: tag `launcher-v<version>` with the installer and the notes from this file.
- Pull request template, this changelog, and README badges and download section.

### Changed

- Renamed the project to **Multi-Account Launcher for Claude** (folder `claude-launcher`, app id
  `com.histuan.claude-launcher`).
- Interface and documentation translated to English; all interface texts live in `src/renderer/strings.ts`.
- Code and tests migrated to TypeScript (`strict`), compiled with `tsc` into `out/`; new `build` and `typecheck` scripts.
- CI: actions updated to v7 (Node 24); runs `typecheck` and tests before the build; runs on pull requests and on
  pushes to `main`.

[Unreleased]: https://github.com/histuan/Claude-Launcher/compare/launcher-v0.2.0...HEAD
[0.2.0]: https://github.com/histuan/Claude-Launcher/compare/launcher-v0.1.0...launcher-v0.2.0
[0.1.0]: https://github.com/histuan/Claude-Launcher/releases/tag/launcher-v0.1.0
