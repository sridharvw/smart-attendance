const test = require('node:test');
const assert = require('node:assert/strict');
const isWithinReliableGeofence = require('../utils/isWithinReliableGeofence');

test('confirms a location only when its uncertainty fits inside the radius', () => {
  assert.equal(isWithinReliableGeofence(80, 20, 100), true);
  assert.equal(isWithinReliableGeofence(81, 20, 100), false);
});

test('does not confirm locations with missing or invalid GPS accuracy', () => {
  assert.equal(isWithinReliableGeofence(20, undefined, 100), false);
  assert.equal(isWithinReliableGeofence(20, -1, 100), false);
});