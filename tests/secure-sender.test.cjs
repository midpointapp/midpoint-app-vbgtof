const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const read = p => fs.readFileSync(p,'utf8');
test('sender screen uses server-validated operations only', () => {
 const code=read('app/session.tsx');
 assert.match(code,/secureSessionRequest/);
 assert.doesNotMatch(code,/\.from\(['"]meet_sessions['"]\)/);
 assert.doesNotMatch(code,/\.from\(['"]session_places['"]\)/);
 assert.doesNotMatch(code,/postgres_changes/);
});
test('new meeting credentials are server-issued and role-separated', () => {
 const create=read('utils/sessionUtils.ts');
 const nav=read('app/meet-now.tsx');
 assert.match(create,/action: 'create'/);
 assert.match(create,/sender_token: response.senderToken/);
 assert.match(nav,/sessionData\.sender_token/);
 assert.doesNotMatch(create,/\.from\(['"]meet_sessions['"]\)/);
});
test('join code is redeemed on server, not queried from public table', () => {
 const home=read('app/(tabs)/(home)/index.tsx');
 assert.match(home,/action: 'redeem'/);
 assert.doesNotMatch(home,/\.from\(['"]meet_sessions['"]\)/);
});
