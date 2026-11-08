# Security review round + community files — planned 1.3.0

## Goal
A best-practice review, not a reaction to a known problem. The launcher barely uses the network, but it starts
processes, deletes profile folders, reads Claude's profile files and installs its own updates, so mistakes there
matter. Add the files a public project is expected to have at the same time.

## Checklist
**Electron**
- `contextIsolation` on, `sandbox` on, `nodeIntegration` off, preload exposes only named functions.
- Content-Security-Policy in `index.html`; no remote content; navigation and new windows blocked.
- Every IPC handler validates its input (types, lengths, ids that must exist in the config).
- `shell.openExternal` only for an allowlist of URLs (repository, releases).
- Electron and all dependencies current; `npm audit` clean or explained.

**Files and processes**
- Profile deletion: the path must resolve inside the profiles folder (no `..`, no symlink escape); never the default
  profile.
- PowerShell calls: arguments passed as data, never by concatenating user text into a script.
- Photos and the memory `.zip`: size limits, type checks, no extraction to disk (already designed; re-check).
- Config writes are atomic (temp file + rename) so a crash cannot corrupt it.

**Secrets and privacy**
- No session tokens, cookies or personal data in logs, diagnostics or crash output.
- If the `sessionKey` idea is ever done: DPAPI only in memory, never written anywhere.

**Updates**
- Updates come only from the GitHub release over HTTPS; after code signing, set `win.publisherName` so the
  signature is checked.

**Repository**
- Dependabot for npm and GitHub Actions; CodeQL workflow; secret scanning; branch protection on `main`;
  Actions pinned to versions.

## Community files
- `SECURITY.md`: how to report a problem privately (GitHub private vulnerability reporting).
- Issue templates: bug report (asks for the "Copy diagnostics" text) and idea.
- `CONTRIBUTING.md`: how to build, test and open a PR; `CODE_OF_CONDUCT.md`.
- GitHub Discussions for questions, so issues stay for bugs.

## How
Run the review with the `vibe-security` skill plus this checklist; write the findings as a short report
(`docs/security-review-1.3.md`); fix each finding in the same PR when small, or open an issue when not.

## Done when
Every item is checked, findings fixed or tracked, the report and the community files are in the repo, and the
GitHub "Community standards" page is complete.
