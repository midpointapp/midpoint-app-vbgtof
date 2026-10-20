const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const app = JSON.parse(fs.readFileSync('app.json', 'utf8')).expo;
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
test('MidPoint app identity is configured', () => {
  assert.equal(app.slug, 'midpoint-meet');
  assert.equal(app.ios.bundleIdentifier, 'com.midpointmeet.app');
  assert.equal(app.android.package, 'com.midpointmeet.app');
});
test('invite links have a configured native scheme', () => {
  assert.equal(app.scheme, 'midpointmeet');
  assert.ok(app.android.intentFilters.some(f => f.data?.some(d => d.scheme === app.scheme)));
});
test('app has location and database dependencies', () => {
  assert.ok(pkg.dependencies['expo-location']);
  assert.ok(pkg.dependencies['@supabase/supabase-js']);
});
