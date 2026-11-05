// 0.5.1: the Windows name and the main profile come from the config at once, refreshed after the cards are shown.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CachedLookup } from '../src/core/cachedLookup.js';

function setup<T>(cached: T | undefined, result: () => Promise<T>) {
  const s = { lookups: 0, saved: [] as T[], changed: [] as T[] };
  const lookup = new CachedLookup<T>({
    cached,
    lookUp: () => { s.lookups++; return result(); },
    save: async (v) => { s.saved.push(v); },
    onChange: (v) => s.changed.push(v),
  });
  return { s, lookup };
}

test('with a cache: answers at once without a lookup', async () => {
  const { s, lookup } = setup<string>('Alex', async () => 'Alex');
  assert.equal(await lookup.get(), 'Alex');
  assert.equal(s.lookups, 0);
});

test('without a cache: waits for the lookup and saves it', async () => {
  const { s, lookup } = setup<string | null>(undefined, async () => null);
  assert.equal(await lookup.get(), null);
  assert.equal(s.lookups, 1);
  assert.deepEqual(s.saved, [null]);
  await lookup.refresh(); // already fresh: no second query
  assert.equal(s.lookups, 1);
});

test('refresh: same value = nothing saved, nothing redrawn', async () => {
  const { s, lookup } = setup<string>('Alex', async () => 'Alex');
  await lookup.refresh();
  assert.equal(s.lookups, 1);
  assert.deepEqual(s.saved, []);
  assert.deepEqual(s.changed, []);
});

test('refresh: a new value is saved, used and reported', async () => {
  const { s, lookup } = setup<string | null>('C:\\old', async () => 'C:\\new');
  await lookup.refresh();
  assert.equal(await lookup.get(), 'C:\\new');
  assert.deepEqual(s.saved, ['C:\\new']);
  assert.deepEqual(s.changed, ['C:\\new']);
});

test('a failed refresh keeps the cached value', async () => {
  const { s, lookup } = setup<string>('Alex', async () => { throw new Error('PowerShell timed out'); });
  await lookup.refresh();
  assert.equal(await lookup.get(), 'Alex');
  assert.deepEqual(s.saved, []);
});

test('lookUpNow (Sign in) always queries and returns the fresh value', async () => {
  let value = 'C:\\a';
  const { s, lookup } = setup<string | null>('C:\\a', async () => value);
  value = 'C:\\b';
  assert.equal(await lookup.lookUpNow(), 'C:\\b');
  assert.equal(await lookup.get(), 'C:\\b');
  assert.deepEqual(s.changed, ['C:\\b']);
});
