# Presentation: README, media, website — planned 1.5.0

## Goal
Make the project easy to understand and trust in a few seconds: a clear GitHub page, short demo videos, and a tiny
website whose only job is "see it working, download it".

## README and GitHub page
- Hero screenshot (dark and light side by side), one-sentence pitch, big Download button (latest release), short
  feature list, "How it works" in three steps, SmartScreen note, FAQ, "not affiliated with Anthropic".
- Release notes: same structure every time (highlights, fixes, how to update).
- Repository description, topics and a social preview image (shown when the link is shared).

## Demo videos / GIFs
- 3 short clips (15–30 s): opening two accounts side by side; adding an account; switching the theme (dark ↔ light,
  following Windows).
- Recorded with **privacy mode on** and test accounts with generic names (John Doe), so no real e-mail appears.
- Tools: Windows Snipping Tool / Xbox Game Bar / OBS for recording; ffmpeg to cut, compress and make GIFs (the
  agent can run ffmpeg and prepare a storyboard and a recording checklist; it may try recording through computer use,
  but recording by hand will likely look better).
- Store compressed versions only (MP4 for the site, GIF or MP4 in the README).

## Website
- Static HTML + CSS + a little JS, no login, no tracking, no build step. Hosted on GitHub Pages from the repository
  (folder `site/`, deployed by an Actions workflow).
- Sections: hero with the video, Download button (latest release), features, dark/light screenshots,
  "Open source · MIT" with the repository link, FAQ (SmartScreen, privacy: everything stays on the PC), footer with
  "not affiliated with Anthropic".
- Original visuals only (the launcher's own icon; never the Anthropic logo). Respects the visitor's light/dark
  preference.

## Done when
README, release notes and repository settings are updated; the three clips exist; the website is live and its
Download button gets the latest installer.
