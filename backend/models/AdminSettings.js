const mongoose = require('mongoose');

const adminSettingsSchema = new mongoose.Schema({
  key: { type: String, unique: true, default: 'admin' },
  passwordHash: { type: String, required: true },
  passwordVersion: { type: Number, default: 1 },
  passwordChangedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('AdminSettings', adminSettingsSchema);