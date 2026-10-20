const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const receiver = fs.readFileSync('app/session/[id].tsx', 'utf8');
test('receiver uses token-validated session API', () => {
  assert.match(receiver, /secureSessionRequest/);
  assert.match(receiver, /callApi\('get'\)/);
  assert.match(receiver, /callApi\('receiver_location'/);
  assert.match(receiver, /callApi\('agree'/);
  assert.match(receiver, /callApi\('decline'/);
});
test('receiver does not bypass API via direct database tables or realtime changefeed', () => {
  assert.doesNotMatch(receiver, /\.from\(['"]meet_sessions['"]\)/);
  assert.doesNotMatch(receiver, /\.from\(['"]session_places['"]\)/);
  assert.doesNotMatch(receiver, /postgres_changes/);
});
test('receiver compares proposed place by external place ID', () => {
  assert.match(receiver, /p\.place_id === session\.proposed_place_id/);
});
