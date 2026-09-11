const test = require('node:test');
const assert = require('node:assert/strict');
const calculateDistance = require('../utils/geoDistance');

test('returns zero for the same coordinates', () => {
  assert.equal(calculateDistance(13.0489, 77.5922, 13.0489, 77.5922), 0);
});

test('calculates a short distance in meters', () => {
  const distance = calculateDistance(13.0489, 77.5922, 13.0498, 77.5922);
  assert.ok(distance > 90 && distance < 110);
});