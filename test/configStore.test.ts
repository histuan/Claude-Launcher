import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { defaultConfig, demoConfig, renameAccount } from '../src/core/config.js';
import { ConfigStore } from '../src/main/configStore.js';

async function tempDir(t: { after: (fn: () => Promise<void>) => void }): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'launcher-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

test('first run: writes the seed config to disk', async (t) => {
  const file = path.join(await tempDir(t), 'sub', 'config.json');
  const store = new ConfigStore(file);
  const seed = demoConfig('C:\\Users\\x');
  assert.deepEqual(await store.load(() => seed), seed);
  assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), seed);
});

test('update saves to disk and the next load reads it back', async (t) => {
  const file = path.join(await tempDir(t), 'config.json');
  const store = new ConfigStore(file);
  await store.load(() => demoConfig('C:\\Users\\x'));
  const id = store.current.accounts[1]!.id;
  await Promise.all([
    store.update((c) => renameAccount(c, id, 'One')),
    store.update((c) => ({ ...c, greetingName: 'Thi' })),
  ]);
  const again = await new ConfigStore(file).load(() => defaultConfig());
  assert.equal(again.accounts[1]?.label, 'One');
  assert.equal(again.greetingName, 'Thi');
});

test('corrupt file: kept aside as a backup, starts from the default config', async (t) => {
  const dir = await tempDir(t);
  const file = path.join(dir, 'config.json');
  await writeFile(file, '{ not json');
  const cfg = await new ConfigStore(file).load(() => demoConfig('C:\\Users\\x'));
  assert.deepEqual(cfg, defaultConfig());
  const files = await readdir(dir);
  assert.ok(files.some((f) => f.startsWith('config.json.corrupt-')), files.join(','));
  assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), defaultConfig());
});
