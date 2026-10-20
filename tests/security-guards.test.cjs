const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const read = p => fs.readFileSync(p, 'utf8');
test('session creation does not print invitation token or exact sender location', () => {
  const code = read('utils/sessionUtils.ts');
  assert.doesNotMatch(code, /console\.log\([^\n]*Invite token:/);
  assert.doesNotMatch(code, /console\.log\([^\n]*Sender location:/);
});
test('Supabase client never logs any key prefix', () => {
  const code = read('app/integrations/supabase/client.ts');
  assert.doesNotMatch(code, /console\.log\([^\n]*supabaseAnonKey\.slice/);
});
test('receiver session does not log token or complete row payload', () => {
  const code = read('app/session/[id].tsx');
  assert.doesNotMatch(code, /console\.log\([^\n]*'token:',\s*token/);
  assert.doesNotMatch(code, /console\.log\([^\n]*'Session load result:',\s*\{\s*data/);
  assert.doesNotMatch(code, /console\.log\([^\n]*'Realtime session update:',\s*payload\.new/);
});
