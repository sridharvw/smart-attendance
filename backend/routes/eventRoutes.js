const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const { getActiveEvent, getPublicEvent, getEvents, createEvent, getCurrentCode, closeEvent } = require('../controllers/eventController');

router.get('/active', getActiveEvent);
router.get('/:eventId/public', getPublicEvent);
router.get('/', adminAuth, getEvents);
router.post('/', adminAuth, createEvent);
router.get('/:eventId/code', adminAuth, getCurrentCode);
router.patch('/:eventId/close', adminAuth, closeEvent);

module.exports = router;