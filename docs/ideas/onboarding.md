# First-run tour — planned 1.5.0 (Phase 12)

## Goal
The first time someone opens the launcher, offer a short guided tour that shows every part of the app in place, so
nobody has to read the README to find the card menu, the memory assistant or the settings. It comes after every
feature exists (so it shows the final app) and before the performance round and the presentation (so the videos can
show it, and the Português phase translates it too).

## When it appears
- **Fresh install only:** no launcher config existed before this start. People who update from an older version
  never get the prompt (they already know the app); the version history ("What's new") tells them the tour exists.
- One small, calm dialog over the main screen:

```
┌──────────────────────────────────────────────┐
│  First time here?                            │
│  A one-minute tour shows where everything is.│
│                                              │
│               [ Not now ]  [ Show me ]       │
└──────────────────────────────────────────────┘
```

- **Not now** → a toast: "You can start the tour any time from Settings → Help." The prompt never comes back by
  itself. **Show me** → the tour starts.
- **Settings → Help → Take the tour** starts it again at any time.

## How the tour looks (spotlight + coach mark)
```
┌──────────────────────────────────────────────────────┐
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│  the rest of the window dims
│░░░░░░░░░┌──────────┐░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│░░░░░░░░░│  ( T )   │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│  the target stays bright, with a soft
│░░░░░░░░░│  Main    │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│  accent ring (spotlight cut-out)
│░░░░░░░░░└──────────┘░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│░░░░░░░░░░░░░▲░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│  arrow from the card to the target
│░░░░░░░░┌─────────────────────────────────┐░░░░░░░░░│
│░░░░░░░░│ Your accounts                2/8 │░░░░░░░░░│  step counter
│░░░░░░░░│ Click a card to open that       │░░░░░░░░░│
│░░░░░░░░│ account in its own Claude.      │░░░░░░░░░│
│░░░░░░░░│ [Skip tour]       [Back] [Next] │░░░░░░░░░│
│░░░░░░░░└─────────────────────────────────┘░░░░░░░░░│
└──────────────────────────────────────────────────────┘
```

- The highlight moves smoothly from one target to the next (a short slide of the cut-out and the card), so the tour
  feels like one continuous movement, not a slideshow. With reduced motion: no slide, an instant switch.
- The card sits beside the target, never covering it, and flips side when there is no room; it follows window
  resizes.
- **Interactive where it is safe:** on the "card menu" step the person opens the ⋯ menu themselves and the tour waits
  for it ("Open the menu to continue"), then closes it again. Nothing that changes accounts runs during the tour.
- **Explained, never run:** Add account (the sign-in closes the main Claude) is shown and described, not started.
- Esc or **Skip tour** ends it at once; keyboard only works (Tab, Enter, ←/→); every step is announced to screen
  readers; the dimmed area does not trap clicks outside the target except to keep focus inside the tour.

## Steps (draft, final texts in `strings.ts`)
1. **Welcome** — what the launcher does in one sentence (several Claude accounts, each in its own window).
2. **Greeting** — "Hover your name to change it."
3. **Your accounts** — click a card to open it; "● Running" shows which are open.
4. **Card menu (⋯)** — rename, photo, details, receive memories, remove. (Interactive: open it.)
5. **Add account** — what happens during a sign-in (the main Claude closes for a moment and comes back).
6. **Shortcuts** — keys 1–9, the taskbar jump list, desktop shortcuts per account.
7. **Settings** — themes, privacy mode, updates, where to find this tour again.
8. **Version** — click it for the full version history.

Steps adapt to what exists: a step whose target is missing (for example no extra account yet) changes its text or is
skipped, never points at nothing.

## Implementation notes
- No library: one small overlay component in the renderer (spotlight via a full-window element with a cut-out,
  positioned from the target's bounding box), reusing the theme variables so it fits every preset.
- Targets are found by a stable `data-tour="…"` attribute, not by CSS classes, so restyling never breaks the tour.
- Config: `tour: { offered: boolean, completed: boolean }`, migrated like the other settings.
- Tests: the fresh-install rule (offered only when no config existed), skip/complete states saved, every step's target
  attribute exists in the DOM, steps with a missing target are skipped.

## Done when
A fresh install offers the tour once, Not now explains where to find it, the tour runs end to end with mouse and with
keyboard only, nothing account-changing runs during it, and it starts again from Settings → Help.
