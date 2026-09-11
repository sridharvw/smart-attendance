const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  name: { type: String, required: true },
  date: { type: Date, required: true },
  venue: { type: String, required: true },
  // Location data for the geofence
  location: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    radius: { type: Number, default: 150 } // in meters
  },
  // Timing
  open_time: { type: Date, required: true },
  close_time: { type: Date, required: true },
  late_time: { type: Date },
  status: { type: String, enum: ['upcoming', 'open', 'closed'], default: 'upcoming' },
  anti_proxy: { type: Boolean, default: true },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Event', eventSchema);