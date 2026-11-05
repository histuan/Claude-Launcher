import { test } from 'node:test';
import assert from 'node:assert/strict';
import { windowsDisplayName } from '../src/main/system/windowsUser.js';

test('uses Win32_UserAccount.FullName, cleaned', async () => {
  let script = '';
  const name = await windowsDisplayName({ USERNAME: 'alex' }, async (s) => { script = s; return 'alexr .\r\n'; });
  assert.equal(name, 'alexr');
  assert.match(script, /Win32_UserAccount/);
});

test('falls back to USERNAME when PowerShell fails or returns nothing', async () => {
  assert.equal(await windowsDisplayName({ USERNAME: 'alex' }, async () => ''), 'alex');
  assert.equal(await windowsDisplayName({ USERNAME: 'alex' }, async () => { throw new Error('timeout'); }), 'alex');
});
