# Easter egg: a tiny runner game — idea, later

## Goal
A hidden, harmless bit of fun, in the spirit of the browser's offline dinosaur game: a small character runs and
jumps over obstacles; the score goes up; one key to jump. Nobody needs it, which is fine for an easter egg, as long as
it costs almost nothing and can never get in the way.

## Rules
- **Original art only.** The runner is the launcher's own spark icon with tiny legs (or another original
  character). Never Anthropic's logo or mascot: not ours, and it would make the project look official.
- **Hidden and opt-in.** Opened only by a secret sequence (for example the classic ↑ ↑ ↓ ↓ ← → ← → B A on the main
  screen, or clicking the greeting icon five times). Esc closes it. Never opens by itself.
- **Tiny.** One `<canvas>`, plain TypeScript, no library, no sound, a few kilobytes. Pauses when the window loses
  focus; respects reduced motion (static "you found it" card instead of the animation).
- **Theme-aware.** Uses the current theme variables, so it looks right in every preset.
- **Playful obstacles, kind jokes.** Tokens to collect, little "context" blocks to jump over; nothing that mocks
  Anthropic, Claude or usage limits.
- Best score kept locally in the launcher config; nothing leaves the PC.

## Done when
The sequence opens the game, it plays smoothly at 60 fps on the PC, Esc and focus loss stop it, the installer grows by
less than 20 KB, and a unit test covers the game's pure logic (collisions, score) with a fixed clock.
