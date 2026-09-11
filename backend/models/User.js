const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  register_number: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  course: { type: String, required: true },
  // Changed from Number to String to accept values like "5 D" or "5 BCA"
  semester: { type: String, required: true },
  role: { type: String, enum: ['volunteer', 'admin', 'superadmin'], default: 'volunteer' },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  password: { type: String }, 
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);