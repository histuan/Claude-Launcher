// Opening Claude so that its window really shows (Phase 4.1). Windows calls are injected, so this is testable.

export interface WindowWaitDeps {
  /** Spawns Claude for the profile (resolves once the process started). */
  launch(): Promise<void>;
  /** true once that profile's main process has a visible top-level window. Errors count as "not yet". */
  hasWindow(): Promise<boolean>;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  /** Total wait for the window (default 8 s). */
  timeoutMs?: number;
  /** Without a window after this long, spawn once more (default 3 s). */
  relaunchAfterMs?: number;
  pollMs?: number;
}

/**
 * A freshly signed-in profile may start in the tray without a window. Spawning the same command again reaches
 * Claude's single-instance handler, which shows the window. true = a window was confirmed within the wait.
 * An error from the first launch is thrown; the second launch is best effort.
 */
export async function launchUntilWindow(deps: WindowWaitDeps): Promise<boolean> {
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = deps.now ?? Date.now;
  const timeout = deps.timeoutMs ?? 8000;
  const relaunchAfter = deps.relaunchAfterMs ?? 3000;
  const start = now();
  await deps.launch();
  let relaunched = false;
  while (now() - start < timeout) {
    await sleep(deps.pollMs ?? 500);
    if (await deps.hasWindow().catch(() => false)) return true;
    if (!relaunched && now() - start >= relaunchAfter) {
      relaunched = true;
      await deps.launch().catch((err: unknown) => console.warn(`Second launch failed: ${(err as Error).message}`));
    }
  }
  return false;
}
