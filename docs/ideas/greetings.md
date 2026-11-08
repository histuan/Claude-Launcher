# Varied greetings by time of day — planned 1.1.0

## Goal
Today the greeting is one of three lines ("Good morning / afternoon / evening, <name>"). Make it feel alive: several
lines per time slot, picked at random, including late-night ones ("night owl"), while the classic lines stay the most
common so it still feels familiar.

## How it works today (checked in the code, 2026-11-08)
- `src/core/greeting.ts` returns a period key (`morning` | `afternoon` | `evening`); the texts live in
  `src/renderer/strings.ts`; `src/renderer/app.ts` renders the greeting and updates it across the boundary.
- The pencil appears only over the **name**, so the name is its own element. Any new line must keep that split.

## Proposal
1. More slots (local time):

| Slot | Hours | Example lines (drafts, all original) |
|---|---|---|
| Late night | 00:00–04:59 | "Still up, {name}?" · "Night owl mode, {name}" · "Burning the midnight oil, {name}" · "Quiet hours, {name}" · "Good evening, {name}" |
| Early morning | 05:00–07:59 | "Good morning, {name}" · "Early start, {name}" · "Up with the sun, {name}" |
| Morning | 08:00–11:59 | "Good morning, {name}" · "Morning, {name}" · "Ready when you are, {name}" |
| Midday | 12:00–13:59 | "Good afternoon, {name}" · "Lunch break, {name}?" |
| Afternoon | 14:00–17:59 | "Good afternoon, {name}" · "Afternoon, {name}" · "Back at it, {name}" |
| Evening | 18:00–20:59 | "Good evening, {name}" · "Evening, {name}" |
| Night | 21:00–23:59 | "Good evening, {name}" · "Winding down, {name}?" · "One more thing, {name}?" |

2. Each line is a template with `{name}`: the renderer splits it into **prefix + name + suffix** (e.g. "Still up, " +
   name + "?"), so the pencil-on-the-name rule keeps working.
3. Picking: random within the slot, chosen **once per window open** (no change while the person looks at it), never
   the same line twice in a row (remember the last one in memory). The classic line has a higher weight.
4. Crossing a slot boundary with the window open: switch to a line from the new slot (as today).
5. A setting "Greeting: varied / classic only" (see `settings-and-theme.md`).

## Tests
- Every minute of the day maps to exactly one slot; every slot has at least one line; every line has exactly one
  `{name}`; with an injected random source the pick is deterministic; no immediate repeat.
- Long names still truncate with the tooltip, with prefix and suffix around them.

## Open questions
- Special days (New Year, weekend lines)? Keep it out of 1.1 to stay small.
- Exact wording: review the drafts; keep them short so long names still fit.

## Done when
Lines vary on reopen, late night shows the late-night set, the pencil still appears only over the name, the classic
option works, and all texts are in `strings.ts`.
