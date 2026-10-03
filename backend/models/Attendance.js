const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  event_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['present', 'needs_review', 'absent', 'rejected'], default: 'present' },
  location: {
    latitude: Number,
    longitude: Number,
    accuracy: Number,
    distance_from_venue: Number
  },
  device_id: { type: String },
    source: { type: String, enum: ['volunteer', 'admin'], default: 'volunteer' },
  override_reason: { type: String } // NEW: Stores admin reasoning
}, { timestamps: true });

module.exports = mongoose.model('Attendance', attendanceSchema);