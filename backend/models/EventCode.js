const mongoose = require('mongoose');

const eventCodeSchema = new mongoose.Schema({
  event_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  code: { type: String, required: true },
  valid_from: { type: Date, required: true },
  valid_until: { type: Date, required: true }
});

module.exports = mongoose.model('EventCode', eventCodeSchema);