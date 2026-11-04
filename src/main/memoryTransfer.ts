// "Receive memories from…" (Phase 5.1): the guided steps, with the memory text (one or more parts, each under the
// limit, imported one Start import at a time) kept ONLY in this object's memory.
// It is never written to disk or to a log, and it is cleared on Done and on Cancel. Windows calls are injected.
import type { ActionError } from '../core/api.js';
import { checkMemoryText } from '../core/memories.js';

/** A 2 MB export split at 100,000 characters needs about 21 parts; more is not a memory export. */
export const MAX_MEMORY_PARTS = 25;

/** warning → (Proceed) copy: source open, waiting for the text → import: target open, a part on the clipboard. */
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
  private parts: string[] = [];

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

  /**
   * The text in parts (the window splits it by whole files): part 1 goes on the clipboard, then the target account
   * opens. No part, an empty part or a part over the limit throws (nothing is taken).
   */
  async useParts(parts: string[]): Promise<ActionError | null> {
    const session = this.at('copy');
    if (parts.length === 0 || parts.length > MAX_MEMORY_PARTS) throw new Error(`Memory parts refused: ${parts.length}`);
    const checked = parts.map(checkMemoryText);
    const bad = checked.findIndex((c) => 'error' in c);
    if (bad >= 0) throw new Error(`Memory part ${bad + 1} refused: ${(checked[bad] as { error: string }).error}`);
    this.parts = checked.map((c) => (c as { text: string }).text);
    await this.deps.writeClipboard(this.parts[0]!);
    session.step = 'import';
    this.deps.log(`memories: step import (part 1 of ${this.parts.length} on the clipboard)`);
    const error = await this.deps.open(session.targetId);
    if (error) this.deps.log(`memories: open ${session.targetId} failed (${error})`);
    return error;
  }

  /** Copy part / Next part: puts that part (0-based) on the clipboard. */
  async copyPart(index: number): Promise<void> {
    this.at('import');
    const part = this.parts[index];
    if (!Number.isInteger(index) || part === undefined) throw new Error(`No memory part ${index + 1}`);
    await this.deps.writeClipboard(part);
    this.deps.log(`memories: part ${index + 1} of ${this.parts.length} on the clipboard`);
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

  /** Forgets the parts and empties the clipboard if it still holds one (the person may have copied something else). */
  private async clear(): Promise<void> {
    const parts = this.parts;
    this.parts = [];
    this.session = null;
    if (parts.length > 0 && parts.includes(await this.deps.readClipboard())) await this.deps.writeClipboard('');
  }

  private at(step: MemoryStep): { sourceId: string; targetId: string; step: MemoryStep } {
    if (this.session?.step !== step) throw new Error(`Memories: not at step ${step}`);
    return this.session;
  }
}
