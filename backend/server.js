const express = require('express');
require('dotenv').config();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('./config/db');
const AdminSettings = require('./models/AdminSettings');
const adminAuth = require('./middleware/adminAuth');

// Initialize the Express application
const app = express();

// Middleware to parse JSON and allow Cross-Origin requests from the React frontend
app.use(express.json());
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(origin => origin.trim())
  : null;
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || !allowedOrigins || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origin is not allowed'));
  }
}));

app.get('/api/health', (req, res) => {
  const databaseReady = mongoose.connection.readyState === 1;
  res.status(databaseReady ? 200 : 503).json({
    status: databaseReady ? 'ok' : 'starting',
    database: databaseReady ? 'connected' : 'disconnected'
  });
});

// Connect to MongoDB
connectDB();

// ----------------------------------------------------
// Admin Authentication Route
// ----------------------------------------------------
app.post('/api/admin/login', async (req, res) => {
  const { password } = req.body;
  try {
    const settings = await AdminSettings.findOne({ key: 'admin' });
    const validPassword = settings
      ? await bcrypt.compare(password || '', settings.passwordHash)
      : password === (process.env.ADMIN_PASSWORD || 'Nss@2021');

    if (!validPassword) return res.status(401).json({ message: 'Invalid password' });

    const token = jwt.sign(
      { role: 'admin', passwordVersion: settings?.passwordVersion || 0 },
      process.env.JWT_SECRET || 'change-this-jwt-secret',
      { expiresIn: '8h' }
    );
    res.json({ success: true, token });
  } catch (error) {
    res.status(500).json({ message: 'Could not verify admin password' });
  }
});

app.post('/api/admin/change-password', adminAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (typeof newPassword !== 'string' || newPassword.length < 10) {
    return res.status(400).json({ message: 'New password must be at least 10 characters long' });
  }
  if (newPassword === currentPassword) {
    return res.status(400).json({ message: 'Choose a different password' });
  }

  try {
    const settings = await AdminSettings.findOne({ key: 'admin' });
    const currentPasswordIsValid = settings
      ? await bcrypt.compare(currentPassword || '', settings.passwordHash)
      : currentPassword === (process.env.ADMIN_PASSWORD || 'Nss@2021');
    if (!currentPasswordIsValid) return res.status(401).json({ message: 'Current password is incorrect' });

    const passwordHash = await bcrypt.hash(newPassword, 12);
    if (settings) {
      settings.passwordHash = passwordHash;
      settings.passwordVersion += 1;
      settings.passwordChangedAt = new Date();
      await settings.save();
    } else {
      await AdminSettings.create({ key: 'admin', passwordHash, passwordVersion: 1 });
    }

    res.json({ message: 'Password changed. Sign in again with the new password.' });
  } catch (error) {
    res.status(500).json({ message: 'Could not change admin password' });
  }
});

// ----------------------------------------------------
// Main Application Routes
// ----------------------------------------------------
const attendanceRoutes = require('./routes/attendanceRoutes');
app.use('/api/attendance', attendanceRoutes);

const eventRoutes = require('./routes/eventRoutes');
app.use('/api/events', eventRoutes);

// ----------------------------------------------------
// Start Server
// ----------------------------------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});