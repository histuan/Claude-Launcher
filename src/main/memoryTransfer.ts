// "Receive memories from…" (Phase 5.1): the guided steps, with the pasted text kept ONLY in this object's memory.
// It is never written to disk or to a log, and it is cleared on Done and on Cancel. Windows calls are injected.
import type { ActionError } from '../core/api.js';
import { checkMemoryText } from '../core/memories.js';

/** warning → (Proceed) copy: source open, waiting for the text → import: target open, text on the clipboard. */
export type MemoryStep = 'warning' | 'copy' | 'import';

export interface MemoryTransferDeps {
  /** Opens the account's Claude and leaves the launcher open. */
  open(accountId: string): Promise<ActionError | null>;
  writeClipboard(text: string): Promise<void>;
  readClipboard(): Promise<string>;
  /** Step names and account ids only. */
  log(line: string): void;
}

export class MemoryTransfer {
  private session: { sourceId: string; targetId: string; step: MemoryStep } | null = null;
  private text = '';

  constructor(private readonly deps: MemoryTransferDeps) {}

  get step(): MemoryStep | null {
    return this.session?.step ?? null;
  }

  /** Starts on the warning: nothing is opened and no text is taken until Proceed. */
  async begin(sourceId: string, targetId: string): Promise<void> {
    if (sourceId === targetId) throw new Error('Source and target are the same account');
    await this.clear();
    this.session = { sourceId, targetId, step: 'warning' };
    this.deps.log(`memories: ${sourceId} → ${targetId}: warning`);
  }

  /** Proceed: opens the source account. A failed open stays on the warning. */
  async proceed(): Promise<ActionError | null> {
    const session = this.at('warning');
    const error = await this.deps.open(session.sourceId);
    if (error) {
      this.deps.log(`memories: open ${session.sourceId} failed (${error})`);
      return error;
    }
    if (this.session === session) session.step = 'copy';
    this.deps.log('memories: step copy');
    return null;
  }

  /** The pasted text: put on the clipboard, then the target account opens. An empty or huge text throws. */
  async useText(text: string): Promise<ActionError | null> {
    const session = this.at('copy');
    const checked = checkMemoryText(text);
    if ('error' in checked) throw new Error(`Memory text refused: ${checked.error}`);
    this.text = checked.text;
    await this.deps.writeClipboard(this.text);
    session.step = 'import';
    this.deps.log('memories: step import (text on the clipboard)');
    const error = await this.deps.open(session.targetId);
    if (error) this.deps.log(`memories: open ${session.targetId} failed (${error})`);
    return error;
  }

  async copyAgain(): Promise<void> {
    this.at('import');
    await this.deps.writeClipboard(this.text);
    this.deps.log('memories: copy again');
  }

  async finish(): Promise<void> {
    if (!this.session) return;
    await this.clear();
    this.deps.log('memories: done');
  }

  async cancel(): Promise<void> {
    if (!this.session) return;
    await this.clear();
    this.deps.log('memories: cancelled');
  }

  /** Forgets the text and empties the clipboard if it still holds it (the person may have copied something else). */
  private async clear(): Promise<void> {
    const text = this.text;
    this.text = '';
    this.session = null;
    if (text && (await this.deps.readClipboard()) === text) await this.deps.writeClipboard('');
  }

  private at(step: MemoryStep): { sourceId: string; targetId: string; step: MemoryStep } {
    if (this.session?.step !== step) throw new Error(`Memories: not at step ${step}`);
    return this.session;
  }
}
