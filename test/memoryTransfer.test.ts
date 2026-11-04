// Phase 5.1: the warning comes first, the text never reaches a log, Done and Cancel clear it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryTransfer } from '../src/main/memoryTransfer.js';

const SECRET = 'I like tea. My cat is called Pixel.';

function setup(openError: 'launchFailed' | null = null) {
  const s = { opened: [] as string[], clipboard: 'before', logs: [] as string[] };
  const transfer = new MemoryTransfer({
    open: async (id) => { s.opened.push(id); return openError; },
    writeClipboard: async (text) => { s.clipboard = text; },
    readClipboard: async () => s.clipboard,
    log: (line) => s.logs.push(line),
  });
  return { s, transfer };
}

test('the warning comes first: nothing opens and no text is taken before Proceed', async () => {
  const { s, transfer } = setup();
  assert.equal(transfer.step, null);
  await assert.rejects(transfer.proceed());
  await transfer.begin('work', 'main');
  assert.equal(transfer.step, 'warning');
  assert.deepEqual(s.opened, []);
  await assert.rejects(transfer.useText(SECRET));
  assert.equal(s.clipboard, 'before');
  assert.equal(await transfer.proceed(), null);
  assert.equal(transfer.step, 'copy');
  assert.deepEqual(s.opened, ['work']);
});

test('the text goes to the clipboard, then the target opens; Copy again puts it back', async () => {
  const { s, transfer } = setup();
  await transfer.begin('work', 'main');
  await transfer.proceed();
  assert.equal(await transfer.useText(`  ${SECRET}\n`), null);
  assert.equal(transfer.step, 'import');
  assert.equal(s.clipboard, SECRET);
  assert.deepEqual(s.opened, ['work', 'main']);
  s.clipboard = 'something else';
  await transfer.copyAgain();
  assert.equal(s.clipboard, SECRET);
});

test('an empty text is refused and nothing opens', async () => {
  const { s, transfer } = setup();
  await transfer.begin('work', 'main');
  await transfer.proceed();
  await assert.rejects(transfer.useText('   '));
  assert.equal(transfer.step, 'copy');
  assert.deepEqual(s.opened, ['work']);
});

test('Done clears the text and the clipboard (only while it still holds the text)', async () => {
  const { s, transfer } = setup();
  await transfer.begin('work', 'main');
  await transfer.proceed();
  await transfer.useText(SECRET);
  await transfer.finish();
  assert.equal(transfer.step, null);
  assert.equal(s.clipboard, '');
  await assert.rejects(transfer.copyAgain());

  const other = setup();
  await other.transfer.begin('work', 'main');
  await other.transfer.proceed();
  await other.transfer.useText(SECRET);
  other.s.clipboard = 'copied by the person later';
  await other.transfer.finish();
  assert.equal(other.s.clipboard, 'copied by the person later');
});

test('Cancel at any step clears everything', async () => {
  const { s, transfer } = setup();
  await transfer.begin('work', 'main');
  await transfer.proceed();
  await transfer.useText(SECRET);
  await transfer.cancel();
  assert.equal(transfer.step, null);
  assert.equal(s.clipboard, '');
  await transfer.cancel(); // twice is harmless
});

test('a failed open is reported and the step does not move on', async () => {
  const { transfer } = setup('launchFailed');
  await transfer.begin('work', 'main');
  assert.equal(await transfer.proceed(), 'launchFailed');
  assert.equal(transfer.step, 'warning');
});

test('the text never reaches the log', async () => {
  const { s, transfer } = setup();
  await transfer.begin('work', 'main');
  await transfer.proceed();
  await transfer.useText(SECRET);
  await transfer.copyAgain();
  await transfer.finish();
  assert.ok(s.logs.length > 0);
  for (const line of s.logs) {
    assert.ok(!line.includes('tea') && !line.includes('Pixel'), line);
  }
});

test('the same account cannot be source and target', async () => {
  const { transfer } = setup();
  await assert.rejects(transfer.begin('main', 'main'));
});
