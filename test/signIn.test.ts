import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  accountKeyNames, claudeVersion, containsSessionKey, defaultSlot, hasOauth, newAccountKey, parseMarker, type Marker,
} from '../src/core/signIn.js';

const marker: Marker = {
  version: 1, state: 'signing-in', slot: 'C:\\L\\Packages\\Claude_x\\LocalCache\\Roaming\\Claude',
  stash: 'C:\\L\\Packages\\Claude_x\\LocalCache\\Roaming\\Claude.launcher-stash', stashed: true, mainWasRunning: true,
  account: { id: 'work', label: 'Work', profileDir: 'C:\\U\\ClaudeProfiles\\work', isNew: true }, startedAt: 1,
};

test('marker: round trip; stash must be the slot + suffix and the slot the Claude folder', () => {
  assert.deepEqual(parseMarker(JSON.parse(JSON.stringify(marker))), marker);
  assert.equal(parseMarker({ ...marker, stash: 'C:\\elsewhere' }), null);
  assert.equal(parseMarker({ ...marker, slot: 'C:\\Users\\x', stash: 'C:\\Users\\x.launcher-stash' }), null);
  const real = 'C:\\L\\Claude-Data\\claude_pzs8sxrjxfjjc';
  assert.equal(parseMarker({ ...marker, slot: real, stash: real + '.launcher-stash' })?.slot, real);
  assert.equal(parseMarker({ ...marker, state: 'weird' }), null);
  assert.equal(parseMarker({ ...marker, account: null }), null);
  assert.equal(parseMarker('nope'), null);
});

test('oauth keys in config.json: only the key names count, never their values', () => {
  assert.equal(hasOauth('{"oauth:tokenCacheV2":"abc"}'), true);
  assert.equal(hasOauth('{"oauth:tokenCache":"abc"}'), true);
  assert.equal(hasOauth('{"oauth:tokenCacheV2":""}'), true, 'the key name is the signal, the value is not read');
  assert.equal(hasOauth('{"locale":"en","note":"oauth:tokenCache"}'), false, 'a value that looks like the key');
  assert.equal(hasOauth('null'), false);
  assert.equal(hasOauth('{"locale":"en"}'), false);
  assert.equal(hasOauth('not json'), false);
});

test('sessionKey cookie present in the cookie database files', () => {
  assert.equal(containsSessionKey([Buffer.from('xx claude.ai sessionKey yy')]), true);
  assert.equal(containsSessionKey([Buffer.from('nothing'), Buffer.from('__cf_bm')]), false);
  assert.equal(containsSessionKey([]), false);
});

// Claude 3.6556 wrote oauth:tokenCache(V2); Claude 4.4212 writes lastKnownAccountUuid instead (no oauth: key at all).
const V3 = JSON.stringify({ locale: 'en', windowSize: 1, 'oauth:tokenCache': 'enc', 'oauth:tokenCacheV2': 'enc' });
const V4 = JSON.stringify({ locale: 'en', windowSizeWasSignedIn: true, lastKnownAccountUuid: 'uuid' });

test('account key names: oauth:*, lastKnownAccountUuid or *Account*; names only, never values', () => {
  assert.deepEqual(accountKeyNames(V3), ['oauth:tokenCache', 'oauth:tokenCacheV2']);
  assert.deepEqual(accountKeyNames(V4), ['lastKnownAccountUuid']);
  assert.deepEqual(accountKeyNames('{"selectedAccountId":1,"oauth:anything":2}'), ['selectedAccountId', 'oauth:anything']);
  assert.deepEqual(accountKeyNames('{"locale":"lastKnownAccountUuid","windowSizeWasSignedIn":true}'), [],
    'a value that looks like a key, and the SignedIn window key, do not count');
  for (const bad of ['', 'not json', 'null', '[]', '"x"']) assert.deepEqual(accountKeyNames(bad), [], bad);
});

test('new account key: only a key that was not there when the sign-in window opened', () => {
  for (const [layout, after] of [['3.x', V3], ['4.x', V4]] as const) {
    assert.notEqual(newAccountKey([], after), null, layout);
    assert.equal(newAccountKey(['locale'], JSON.stringify({ locale: 'en' })), null, layout);
    assert.equal(newAccountKey(accountKeyNames(after), after), null, `${layout}: already there at the start`);
  }
  assert.equal(newAccountKey([], V3), 'oauth:tokenCache');
  assert.equal(newAccountKey([], V4), 'lastKnownAccountUuid');
  assert.equal(newAccountKey(['lastKnownAccountUuid'], `{"lastKnownAccountUuid":1,"oauth:tokenCacheV2":2}`),
    'oauth:tokenCacheV2');
  assert.equal(newAccountKey([], 'not json'), null);
});

test('Claude version from the exe path (MSIX folder name); null when the path has none', () => {
  assert.equal(claudeVersion('C:\\Program Files\\WindowsApps\\Claude_4.4212.0.0_x64__pzs8sxrjxfjjc\\app\\Claude.exe'),
    '4.4212.0.0');
  assert.equal(claudeVersion('C:\\Program Files\\WindowsApps\\Claude_3.6556.2.0_x64__pzs8sxrjxfjjc\\app\\Claude.exe'),
    '3.6556.2.0');
  assert.equal(claudeVersion('C:\\Users\\u\\AppData\\Local\\AnthropicClaude\\claude.exe'), null);
});

test('default slot: only a Claude profile folder, trailing separators dropped; never a stash or another folder', () => {
  const real = 'C:\\U\\AppData\\Local\\Claude-Data\\claude_pzs8sxrjxfjjc';
  assert.equal(defaultSlot(real), real);
  assert.equal(defaultSlot(`${real}\\`), real);
  assert.equal(defaultSlot(`${real}\\\\`), real);
  assert.equal(defaultSlot('/home/u/Local/Claude-Data/claude_x/'), '/home/u/Local/Claude-Data/claude_x');
  const msix = 'C:\\U\\AppData\\Local\\Packages\\Claude_x\\LocalCache\\Roaming\\Claude';
  assert.equal(defaultSlot(msix), msix);
  for (const bad of ['C:\\Temp\\profile', 'C:\\U\\ClaudeProfiles\\work', `${real}.launcher-stash`, 'Claude-Data\\claude_x', '']) {
    assert.equal(defaultSlot(bad), null, bad);
  }
});
