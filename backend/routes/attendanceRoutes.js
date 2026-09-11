const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const { getVolunteer, getDirectory, markAttendance, getLiveAttendance, updateAttendanceStatus, exportAttendanceCSV } = require('../controllers/attendanceController');

// Existing routes...
router.get('/volunteer/:register_number', getVolunteer);
router.get('/directory', adminAuth, getDirectory);
router.post('/mark', markAttendance);
router.get('/live/:eventId', adminAuth, getLiveAttendance);
router.patch('/:attendanceId/status', adminAuth, updateAttendanceStatus);

// NEW: CSV Export route
router.get('/export/:eventId', adminAuth, exportAttendanceCSV);

module.exports = router;