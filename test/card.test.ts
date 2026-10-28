// 0.4.3 (c) Main badge and (d) version label.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardBadge, cardStatus } from '../src/core/card.js';
import type { Account } from '../src/core/config.js';
import { strings } from '../src/renderer/strings.js';

const account = (over: Partial<Account>): Account =>
  ({ id: 'x', label: null, email: null, realName: null, photo: null, profileDir: null, ...over });

test('Main badge: on Main, also after a rename; never on other accounts', () => {
  assert.equal(cardBadge(account({ id: 'main' })), 'main');
  assert.equal(cardBadge(account({ id: 'main', label: 'Personal' })), 'main');
  assert.equal(cardBadge(account({ id: 'work', label: 'Main', profileDir: 'C:\\U\\ClaudeProfiles\\main-2' })), null);
  assert.equal(strings.badges.main, 'Main');
});

test('version label: "v" + the app version', () => {
  assert.equal(strings.version('0.4.3'), 'v0.4.3');
});

test('(3) card status: Running, Running · Not signed in, or nothing when closed', () => {
  assert.equal(cardStatus(false, false), null);
  assert.equal(cardStatus(false, true), null, 'a closed card shows Not signed in in its text line instead');
  assert.equal(cardStatus(true, false), 'running');
  assert.equal(cardStatus(true, true), 'runningSignedOut');
  assert.equal(strings.status.running, 'Running');
  assert.equal(strings.status.runningSignedOut, 'Running · Not signed in');
});
