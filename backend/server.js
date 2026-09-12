const express = require('express');
require('dotenv').config();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const connectDB = require('./config/db');

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
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  const validPassword = process.env.ADMIN_PASSWORD || 'Nss@2021';
  
  if (password === validPassword) {
    const token = jwt.sign(
      { role: 'admin' },
      process.env.JWT_SECRET || 'change-this-jwt-secret',
      { expiresIn: '8h' }
    );
    res.json({ success: true, token });
  } else {
    res.status(401).json({ message: 'Invalid password' });
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