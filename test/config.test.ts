import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addAccount, CONFIG_VERSION, defaultConfig, isLauncherProfileDir, parseConfig, profileDirFor,
  afterSignIn, removeAccount, renameAccount, setClaudeApp, setDetails, setGreetingName, setPhoto, setKnownUpdate, setSignedIn, setStartupCache, type Account,
} from '../src/core/config.js';

const acc = (id: string, profileDir: string | null, label: string | null = id): Account =>
  ({ id, label, email: null, realName: null, photo: null, profileDir, signedIn: null });

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
  assert.deepEqual(cfg.accounts[1], { id: 'w', label: 'Work', email: 'a@b.c', realName: null, photo: null, profileDir: 'D:\\p\\w', signedIn: null });
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
    profileDir: 'C:\\Users\\thiag\\ClaudeProfiles\\trabalho-agil', signedIn: null,
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

test('after a sign-in: the new card is added once (signed in); an existing card is marked signed in', () => {
  const work = { id: 'work', label: 'Work', profileDir: 'C:\\P\\work', isNew: true };
  const base = parseConfig({ accounts: [acc('main', null)] });
  const added = afterSignIn(base, work);
  assert.deepEqual(added.accounts[1], { ...acc('work', 'C:\\P\\work', 'Work'), signedIn: true });
  assert.equal(afterSignIn(added, work).accounts.length, 2, 'never added twice');
  assert.equal(afterSignIn(added, { ...work, isNew: false }), added, 'already signed in: unchanged');
  const out = setSignedIn(added, 'work', false);
  assert.equal(afterSignIn(out, { ...work, isNew: false }).accounts[1]?.signedIn, true);
});

test('last known signed-in state: kept from disk, saved per extra account, never on Main', () => {
  const cfg = parseConfig({ accounts: [acc('main', null), { ...acc('w', 'D:\\w'), signedIn: false }, { ...acc('x', 'D:\\x'), signedIn: 'yes' }] });
  assert.deepEqual(cfg.accounts.map((a) => a.signedIn), [null, false, null], 'only a boolean is kept');
  const saved = setSignedIn(cfg, 'w', true);
  assert.equal(saved.accounts[1]?.signedIn, true);
  assert.equal(cfg.accounts[1]?.signedIn, false, 'input not mutated');
  assert.equal(setSignedIn(saved, 'w', true), saved, 'same state: same config (no write)');
  assert.equal(setSignedIn(saved, 'main', true), saved);
  assert.equal(setSignedIn(saved, 'nope', true), saved);
});

test('parseConfig drops an old cookiePending flag (a build of 0.4.4 wrote it)', () => {
  const cfg = parseConfig({ accounts: [acc('main', null), { ...acc('work', 'C:\\P\\work'), cookiePending: true }] });
  assert.equal('cookiePending' in cfg.accounts[1], false);
});

test('Claude.exe cache: kept only for an MSIX Claude.exe path; default and bad values give null', () => {
  const exe = 'C:\\Program Files\\WindowsApps\\Claude_4.16336.0.0_x64__pzs8sxrjxfjjc\\app\\Claude.exe';
  assert.equal(defaultConfig().claudeApp, null);
  const good = { accounts: [], claudeApp: { exe, family: 'Claude_pzs8sxrjxfjjc' } };
  assert.deepEqual(parseConfig(good).claudeApp, { exe, family: 'Claude_pzs8sxrjxfjjc' });
  assert.deepEqual(parseConfig({ accounts: [], claudeApp: { exe } }).claudeApp, { exe, family: null });
  for (const bad of [{ exe: 'C:\\Temp\\evil.exe' }, { exe: 42 }, 'x', null, undefined]) {
    assert.equal(parseConfig({ accounts: [], claudeApp: bad }).claudeApp, null, JSON.stringify(bad));
  }
  const cfg = setClaudeApp(defaultConfig(), { exe, family: null });
  assert.deepEqual(cfg.claudeApp, { exe, family: null });
  assert.deepEqual(cfg.accounts, defaultConfig().accounts);
});

test('Add account: the typed details go on the new card; an invalid e-mail is not saved', () => {
  const base = parseConfig({ accounts: [acc('main', null)] });
  const work = { id: 'work', label: 'Work', profileDir: 'C:\\P\\work', isNew: true };
  const added = afterSignIn(base, { ...work, email: ' me@work.com ', realName: 'Thiago G.' });
  assert.equal(added.accounts[1]?.email, 'me@work.com');
  assert.equal(added.accounts[1]?.realName, 'Thiago G.');
  assert.equal(afterSignIn(base, { ...work, email: 'nope' }).accounts[1]?.email, null);
});

test('Edit details: any card (Main too); invalid e-mail or unknown id leaves the config as it is', () => {
  const cfg = parseConfig({ accounts: [acc('main', null), acc('w', 'D:\\w')] });
  const main = setDetails(cfg, 'main', 'thiago@gmail.com', ' Thiago U. ');
  assert.deepEqual([main.accounts[0]?.email, main.accounts[0]?.realName], ['thiago@gmail.com', 'Thiago U.']);
  assert.equal(setDetails(main, 'main', 'thiago@gmail.com', '').accounts[0]?.realName, null, 'real name can be cleared');
  assert.equal(setDetails(cfg, 'w', 'bad', 'x'), cfg);
  assert.equal(setDetails(cfg, 'nope', 'a@b.cd', 'x'), cfg);
  assert.equal(cfg.accounts[0]?.email, null, 'input not mutated');
});

test('photo: set and back to the initial', () => {
  const cfg = parseConfig({ accounts: [acc('main', null)] });
  const withPhoto = setPhoto(cfg, 'main', 'main.png');
  assert.equal(withPhoto.accounts[0]?.photo, 'main.png');
  assert.equal(setPhoto(withPhoto, 'main', null).accounts[0]?.photo, null);
  assert.equal(setPhoto(cfg, 'nope', 'x.png'), cfg);
});

test('startup cache (0.5.1): Windows name and main profile kept from disk; bad values give null', () => {
  assert.equal(defaultConfig().windowsName, null);
  assert.equal(defaultConfig().defaultProfile, null);
  const dir = 'C:\\Users\\u\\AppData\\Local\\Claude-Data\\claude_1';
  const cfg = parseConfig({ accounts: [], windowsName: 'Thiago', defaultProfile: dir });
  assert.equal(cfg.windowsName, 'Thiago');
  assert.equal(cfg.defaultProfile, dir);
  const bad = parseConfig({ accounts: [], windowsName: 3, defaultProfile: '' });
  assert.equal(bad.windowsName, null);
  assert.equal(bad.defaultProfile, null);
  const set = setStartupCache(defaultConfig(), { windowsName: 'Ana' });
  assert.equal(set.windowsName, 'Ana');
  assert.equal(setStartupCache(set, { defaultProfile: dir }).windowsName, 'Ana');
  assert.equal(setStartupCache(setStartupCache(set, { defaultProfile: dir }), { defaultProfile: null }).defaultProfile, null);
});

test('0.6.2: the known update version is kept, and cleared with null', () => {
  const cfg = setKnownUpdate(defaultConfig(), '0.6.3');
  assert.equal(parseConfig(JSON.parse(JSON.stringify(cfg))).knownUpdate, '0.6.3');
  assert.equal(setKnownUpdate(cfg, null).knownUpdate, null);
  assert.equal(parseConfig({ accounts: [], knownUpdate: 42 }).knownUpdate, null);
});
