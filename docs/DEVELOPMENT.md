# How the launcher is developed

The code is written with [Claude Code](https://claude.com/claude-code). This page describes the process around it:
how work is split, what checks it before a release, and how a second model reviews it.

## Phases, one PR each

Work is planned in phases ([`PHASES.md`](./PHASES.md); Phases 0–6 in [`phases-v1.md`](./phases-v1.md)). Each phase
has its own issue (`[launcher] Phase N — …`), runs on its own branch and ends in one Pull Request to `main` that
closes that issue. The PR bumps the version in `package.json` and adds its section to
[`CHANGELOG.md`](../CHANGELOG.md). Small documentation changes go straight to `main`.

## CI

[`.github/workflows/claude-launcher.yml`](../.github/workflows/claude-launcher.yml) runs on every PR and every push
to `main`:

- `npm run typecheck` and `npm test` (`node:test`, with mocks of everything that touches Windows) on Ubuntu and on
  Windows;
- on Windows, the NSIS installer is built; a PR run uploads it as an artifact;
- on a push to `main`, it creates the tag `v<version>` and a GitHub Release with the installer and the notes from
  `CHANGELOG.md`.

The tests also run the launcher's parsers against stored files from each Claude Desktop version it was tested with
(`test/fixtures/claude-<version>/`), so a change in what Claude writes shows up as a failing test.

## Tested on a real PC before the merge

Mocks cannot sign in to Claude, so every PR ends with a "How to test" list in [`STATUS.md`](./STATUS.md). The PR's
installer is installed on a Windows PC with real Claude accounts and the list is checked by hand. The PR is merged
only after that, and the next phase starts only after the merge.

## Cross-model review

Opus implements each phase. Fable, a different model, reviews each PR and audits the project before the merge.
Findings and their fixes are posted as comments on the PR.

Example from 1.0.1: Fable 5.2 reviewed PR #57 in a separate Claude Code session
([review comment](https://github.com/histuan/Claude-Launcher/pull/57#issuecomment-6788792604)). 1.0.1 added
**Sign in again** to the ⋯ menu of every extra card, including signed-in ones. The review found that on a signed-in
card, pressing **I'm signed in** without signing in could replace a working profile with a signed-out
one: `finish()` deleted the account folder before moving the new profile in, because the code still assumed that
only never-signed-in cards could get there. The fix ([`623efed`](https://github.com/histuan/Claude-Launcher/commit/623efed))
moves the new profile in only if it holds a session, sets the old folder aside until the move is done, and adds
tests for each case ([reply to the review](https://github.com/histuan/Claude-Launcher/pull/57#issuecomment-6789074224)).
1.0.1 was then tested on a Windows PC with Claude Desktop 5.1231.0.0 before the merge.

## Security audit

Fable audited `main` (at `87c5030`) on 2026-11-10: the IPC surface and preload, window hardening, PowerShell and WMI
calls, paths built from config values, the self-update, config and logs, and the CI workflow. The findings are in
[this comment on issue #34](https://github.com/histuan/Claude-Launcher/issues/34#issuecomment-6784426251). The issue
stays open because the fixes are planned for 1.3.0 (Phase 10).
