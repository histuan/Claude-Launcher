# Ideas after v1.0

Not planned and not promised. Each idea picked up becomes its own issue and PR.
Ordered roughly from most to least useful.

## Accounts and Claude

1. **Claude Code profiles (terminal).** A card type that opens a terminal with Claude Code already signed in to that
   account, using a separate config folder per account (`CLAUDE_CONFIG_DIR`). Needs copying or linking the global
   `CLAUDE.md`, skills and settings into each config folder; check the current Claude Code docs first.
   (Claude Code inside the desktop app already follows each desktop profile's account.)
2. **Automatic e-mail and name detection** (option 2 in `docs/WINDOWS.md` §5): read the e-mail and account name from
   claude.ai via the `sessionKey` cookie (DPAPI + AES-GCM) instead of typing them. Skipped for v1: the launcher would
   read session tokens, and it can break with any Claude update.
3. **Sign-out seen while Claude is open.** Today a sign-out is only detected after the account is closed (the cookie
   database is locked while Claude runs).
4. **Hidden Claude windows.** Claude has no tray icon on some PCs and keeps running hidden after its window is closed.
   The card could say "Running (hidden)" and offer "Show" or "Close".
5. **Automatic account photo**, once Claude desktop has a profile photo (`docs/SCOPE.md` §6).
6. **Per-account usage meter** (`docs/SCOPE.md` §6), if Claude ever exposes usage in a safe way.
7. **Move more between accounts:** scheduled tasks and MCP servers (`docs/SCOPE.md` §6); Project memories per
   Project (today the memory assistant leaves `projects/` unchecked because it would land in general memory).

## Memory assistant

8. Confirm whether Claude accepts a second "Start import" right after the first, and whether a paste near
   100,000 characters goes in at once; adjust the part size if not.
9. Remove partial real names from the diagnostics report (today only the full name is removed).

## Updates and installer

10. **Sign the installer:** fewer SmartScreen warnings and a smoother first install (then set `win.publisherName` too,
    so the self-update checks the signature). Costs money.
11. **Visible install progress.** The update stays silent because the NSIS "Finish" page needs a click on update
    runs; a small custom NSIS script could close that page by itself and show the progress window.
12. **Smaller installer** (~121 MB, mostly Electron): maximum compression, drop unused files and locales.
13. **Faster first start after install** (5.8 s measured; normal starts ~0.3–1 s) and a faster sign-in window.
14. **Distribution through winget or Scoop**, to install with one command.
15. **"Tested with Claude <version>"** filled in automatically by CI or by the diagnostics.

## Platforms and interface

16. **macOS and Linux** (`docs/SCOPE.md` §6).
17. **Other interface languages**, starting with Portuguese. All texts are already in `src/renderer/strings.ts`.
18. **Light theme** (`docs/SCOPE.md` §6).

## Process

19. **Optimisation rounds:** memory use, startup timings from the `startup:` log, tech-debt list.
20. **Windows 10 test** on a real machine (only Windows 11 was tested).
