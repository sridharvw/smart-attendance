const isWithinReliableGeofence = (distance, accuracy, radius) => (
  Number.isFinite(distance) &&
  Number.isFinite(accuracy) &&
  Number.isFinite(radius) &&
  accuracy >= 0 &&
  radius >= 0 &&
  distance + accuracy <= radius
);

module.exports = isWithinReliableGeofence;