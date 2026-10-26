import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addAccount, CONFIG_VERSION, defaultConfig, isLauncherProfileDir, parseConfig, profileDirFor,
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

test('profile folders live in %USERPROFILE%\\ClaudeProfiles\\<id>', () => {
  assert.equal(profileDirFor('C:\\Users\\someone', 'abc'), 'C:\\Users\\someone\\ClaudeProfiles\\abc');
});

test('parseConfig drops the Phase 2 sample accounts', () => {
  const cfg = parseConfig({ accounts: [acc('main', null), acc('demo-work', 'D:\\dw'), acc('demo-college', 'D:\\dc'), acc('w', 'D:\\w')] });
  assert.deepEqual(cfg.accounts.map((a) => a.id), ['main', 'w']);
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

const HOME = 'C:\\Users\\thiag';

test('add: id from the name, folder under ClaudeProfiles, appended last', () => {
  const result = addAccount(defaultConfig(), '  Trabalho Ágil! ', HOME);
  assert.ok(result);
  assert.deepEqual(result.account, {
    id: 'trabalho-agil', label: 'Trabalho Ágil!', email: null, realName: null, photo: null,
    profileDir: 'C:\\Users\\thiag\\ClaudeProfiles\\trabalho-agil',
  });
  assert.deepEqual(result.config.accounts.map((a) => a.id), ['main', 'trabalho-agil']);
});

test('add: unique ids (existing, reserved, Windows device names, folders already on disk)', () => {
  let cfg = defaultConfig();
  const ids: string[] = [];
  for (const name of ['Work', 'work', 'Main', 'Demo Work', 'CON', '日本', '']) {
    const r = addAccount(cfg, name, HOME, (dir) => dir.endsWith('\\work-3'));
    if (!r) { ids.push('(none)'); continue; }
    cfg = r.config;
    ids.push(r.account.id);
  }
  assert.deepEqual(ids, ['work', 'work-2', 'main-2', 'demo-work-2', 'con-2', 'account', '(none)']);
  const third = addAccount(cfg, 'Work', HOME, (dir) => dir.endsWith('\\work-3'));
  assert.equal(third?.account.id, 'work-4');
});

test('add: name trimmed and capped like rename', () => {
  assert.equal(addAccount(defaultConfig(), 'x'.repeat(100), HOME)?.account.label?.length, 40);
});

test('only direct children of %USERPROFILE%\\ClaudeProfiles count as launcher profile folders', () => {
  assert.equal(isLauncherProfileDir('C:\\Users\\thiag\\ClaudeProfiles\\work', HOME), true);
  assert.equal(isLauncherProfileDir('c:\\users\\THIAG\\claudeprofiles\\work\\', HOME), true);
  assert.equal(isLauncherProfileDir('C:\\Users\\thiag\\ClaudeProfiles', HOME), false);
  assert.equal(isLauncherProfileDir('C:\\Users\\thiag\\ClaudeProfiles\\..', HOME), false);
  assert.equal(isLauncherProfileDir('C:\\Users\\thiag\\ClaudeProfiles\\..\\Documents', HOME), false);
  assert.equal(isLauncherProfileDir('C:\\Users\\thiag\\ClaudeProfiles\\a\\b', HOME), false);
  assert.equal(isLauncherProfileDir('C:\\Users\\thiag\\AppData\\Roaming\\Claude', HOME), false);
  assert.equal(isLauncherProfileDir('', HOME), false);
});
