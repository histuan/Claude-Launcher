# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Releases are tagged `launcher-vX.Y.Z`.

## [Unreleased]

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

[Unreleased]: https://github.com/histuan/Claude-Launcher/compare/launcher-v0.1.0...HEAD
[0.1.0]: https://github.com/histuan/Claude-Launcher/releases/tag/launcher-v0.1.0
