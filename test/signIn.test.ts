import { test } from 'node:test';
import assert from 'node:assert/strict';
import { containsSessionKey, hasOauth, LoginWatch, parseMarker, type Marker } from '../src/core/signIn.js';

const marker: Marker = {
  version: 1, state: 'signing-in', slot: 'C:\\L\\Packages\\Claude_x\\LocalCache\\Roaming\\Claude',
  stash: 'C:\\L\\Packages\\Claude_x\\LocalCache\\Roaming\\Claude.launcher-stash', stashed: true, mainWasRunning: true,
  account: { id: 'work', label: 'Work', profileDir: 'C:\\U\\ClaudeProfiles\\work', isNew: true }, startedAt: 1,
};

test('marker: round trip; stash must be the slot + suffix and the slot the Claude folder', () => {
  assert.deepEqual(parseMarker(JSON.parse(JSON.stringify(marker))), marker);
  assert.equal(parseMarker({ ...marker, stash: 'C:\\elsewhere' }), null);
  assert.equal(parseMarker({ ...marker, slot: 'C:\\Users\\x', stash: 'C:\\Users\\x.launcher-stash' }), null);
  assert.equal(parseMarker({ ...marker, state: 'weird' }), null);
  assert.equal(parseMarker({ ...marker, account: null }), null);
  assert.equal(parseMarker('nope'), null);
});

test('oauth token presence in config.json (never its value)', () => {
  assert.equal(hasOauth('{"oauth:tokenCacheV2":"abc"}'), true);
  assert.equal(hasOauth('{"oauth:tokenCache":"abc"}'), true);
  assert.equal(hasOauth('{"oauth:tokenCacheV2":""}'), false);
  assert.equal(hasOauth('{"locale":"en"}'), false);
  assert.equal(hasOauth('not json'), false);
});

test('sessionKey cookie present in the cookie database files', () => {
  assert.equal(containsSessionKey([Buffer.from('xx claude.ai sessionKey yy')]), true);
  assert.equal(containsSessionKey([Buffer.from('nothing'), Buffer.from('__cf_bm')]), false);
  assert.equal(containsSessionKey([]), false);
});

test('login watch: ready only when the cookie store changes after (or just before) the token', () => {
  const w = new LoginWatch('A', 2000);
  assert.equal(w.sample(0, 'B', false), false); // startup write
  assert.equal(w.sample(5000, 'B', true), false); // token, but the startup write is too old
  assert.equal(w.detected, true);
  assert.equal(w.sample(9000, 'C', true), true); // cookie flushed after the token
});

test('login watch: cookie committed shortly before the token also counts', () => {
  const w = new LoginWatch('A', 2000);
  assert.equal(w.sample(1000, 'B', false), false);
  assert.equal(w.sample(2500, 'B', true), true);
});
