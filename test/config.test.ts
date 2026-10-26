import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONFIG_VERSION, defaultConfig, demoConfig, parseConfig, profileDirFor,
  removeAccount, renameAccount, setGreetingName, type Account,
} from '../src/core/config.js';

const acc = (id: string, profileDir: string | null, label: string | null = id): Account =>
  ({ id, label, email: null, realName: null, photo: null, profileDir });

test('default config has only the Main account (profileDir null)', () => {
  const cfg = defaultConfig();
  assert.equal(cfg.version, CONFIG_VERSION);
  assert.equal(cfg.greetingName, null);
  assert.equal(cfg.accounts.length, 1);
  assert.equal(cfg.accounts[0]?.profileDir, null);
});

test('demo config: Main first, demo accounts under %USERPROFILE%\\ClaudeProfiles', () => {
  const cfg = demoConfig('C:\\Users\\someone');
  assert.equal(cfg.accounts[0]?.profileDir, null);
  assert.ok(cfg.accounts.length > 1);
  for (const a of cfg.accounts.slice(1)) {
    assert.equal(a.profileDir, profileDirFor('C:\\Users\\someone', a.id));
  }
  assert.equal(profileDirFor('C:\\Users\\someone', 'abc'), 'C:\\Users\\someone\\ClaudeProfiles\\abc');
});

test('parseConfig keeps valid data and normalises missing fields', () => {
  const cfg = parseConfig({
    version: 1,
    greetingName: 'Thi',
    accounts: [{ id: 'main', label: null, profileDir: null }, { id: 'w', label: 'Work', email: 'a@b.c', profileDir: 'D:\\p\\w' }],
  });
  assert.equal(cfg.greetingName, 'Thi');
  assert.deepEqual(cfg.accounts[1], { id: 'w', label: 'Work', email: 'a@b.c', realName: null, photo: null, profileDir: 'D:\\p\\w' });
});

test('parseConfig puts Main first, adds it if missing, drops duplicates', () => {
  const moved = parseConfig({ accounts: [acc('w', 'D:\\w'), acc('main', null)] });
  assert.deepEqual(moved.accounts.map((a) => a.id), ['main', 'w']);

  const added = parseConfig({ accounts: [acc('w', 'D:\\w')] });
  assert.equal(added.accounts[0]?.profileDir, null);
  assert.equal(added.accounts.length, 2);

  const dup = parseConfig({ accounts: [acc('main', null), acc('main2', null), acc('w', 'D:\\w'), acc('w', 'D:\\x'), { label: 'no id' }] });
  assert.deepEqual(dup.accounts.map((a) => a.id), ['main', 'w']);
});

test('parseConfig rejects something that is not a config', () => {
  assert.throws(() => parseConfig(null));
  assert.throws(() => parseConfig([]));
  assert.throws(() => parseConfig({ accounts: 'nope' }));
});

test('greeting name: trimmed, empty restores the default (null)', () => {
  const cfg = defaultConfig();
  assert.equal(setGreetingName(cfg, '  Thiago  ').greetingName, 'Thiago');
  assert.equal(setGreetingName(cfg, '   ').greetingName, null);
  assert.equal(setGreetingName(cfg, null).greetingName, null);
  assert.equal(setGreetingName(cfg, 'x'.repeat(100)).greetingName?.length, 40);
  assert.equal(cfg.greetingName, null, 'does not mutate the input');
});

test('rename: trims; empty restores Main default, leaves others unchanged', () => {
  const cfg = parseConfig({ accounts: [acc('main', null, 'Home'), acc('w', 'D:\\w', 'Work')] });
  assert.equal(renameAccount(cfg, 'w', ' Job ').accounts[1]?.label, 'Job');
  assert.equal(renameAccount(cfg, 'w', '  ').accounts[1]?.label, 'Work');
  assert.equal(renameAccount(cfg, 'main', '').accounts[0]?.label, null);
  assert.equal(renameAccount(cfg, 'missing', 'X'), cfg);
});

test('remove: deletes the account, never the Main one', () => {
  const cfg = parseConfig({ accounts: [acc('main', null), acc('w', 'D:\\w')] });
  assert.deepEqual(removeAccount(cfg, 'w').accounts.map((a) => a.id), ['main']);
  assert.equal(removeAccount(cfg, 'main'), cfg);
  assert.equal(removeAccount(cfg, 'missing'), cfg);
});
