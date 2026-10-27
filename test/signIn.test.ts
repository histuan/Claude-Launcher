import { test } from 'node:test';
import assert from 'node:assert/strict';
import { containsSessionKey, hasOauth, parseMarker, type Marker } from '../src/core/signIn.js';

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
