const Event = require('../models/Event');
const EventCode = require('../models/EventCode');

const syncEventStatuses = async () => {
  const now = new Date();
  await Event.updateMany(
    { status: 'upcoming', open_time: { $lte: now }, close_time: { $gt: now } },
    { status: 'open' }
  );
  await Event.updateMany(
    { status: 'open', close_time: { $lte: now } },
    { status: 'closed' }
  );
};

exports.getEvents = async (req, res) => {
  try {
    await syncEventStatuses();
    const events = await Event.find().sort({ date: -1, createdAt: -1 });
    res.json(events);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createEvent = async (req, res) => {
  try {
    const {
      name,
      venue,
      date,
      open_time,
      close_time,
      latitude,
      longitude,
      radius = 150,
      open_now = true
    } = req.body;

    if (!name || !venue || !date || !open_time || !close_time) {
      return res.status(400).json({ message: 'Name, venue, date, open time, and close time are required' });
    }

    const location = {
      latitude: Number(latitude),
      longitude: Number(longitude),
      radius: Number(radius)
    };

    if (!Number.isFinite(location.latitude) || !Number.isFinite(location.longitude) || !Number.isFinite(location.radius) || location.radius <= 0) {
      return res.status(400).json({ message: 'Valid GPS coordinates and radius are required' });
    }

    const eventDate = new Date(date);
    const eventOpenTime = new Date(open_time);
    const eventCloseTime = new Date(close_time);

    if ([eventDate, eventOpenTime, eventCloseTime].some(value => Number.isNaN(value.getTime())) || eventCloseTime <= eventOpenTime) {
      return res.status(400).json({ message: 'Valid dates are required and close time must be after open time' });
    }

    if (open_now) {
      await Event.updateMany({ status: 'open' }, { status: 'closed' });
    }

    const event = await Event.create({
      name: name.trim(),
      venue: venue.trim(),
      date: eventDate,
      open_time: eventOpenTime,
      close_time: eventCloseTime,
      location,
      status: open_now ? 'open' : 'upcoming'
    });

    res.status(201).json(event);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getActiveEvent = async (req, res) => {
  try {
    await syncEventStatuses();
    const event = await Event.findOne({ status: 'open' }).sort({ createdAt: -1 });
    if (!event) {
      return res.status(404).json({ message: 'No active events found' });
    }
    res.json(event);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getCurrentCode = async (req, res) => {
  try {
    const { eventId } = req.params;
    const now = new Date();

    let currentCode = await EventCode.findOne({
      event_id: eventId,
      valid_from: { $lte: now },
      valid_until: { $gte: now }
    });

    if (!currentCode) {
      const code = Math.floor(1000 + Math.random() * 9000).toString();
      const valid_from = now;
      const valid_until = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes

      await EventCode.deleteMany({ event_id: eventId });

      currentCode = await EventCode.create({
        event_id: eventId,
        code,
        valid_from,
        valid_until
      });
    }

    const secondsLeft = Math.round((new Date(currentCode.valid_until) - now) / 1000);

    res.json({
      code: currentCode.code,
      expires_in: secondsLeft > 0 ? secondsLeft : 300
    });
  } catch (error) {
    console.error("Error in getCurrentCode:", error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.closeEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await Event.findByIdAndUpdate(
      eventId, 
      { status: 'closed' }, 
      { returnDocument: 'after' }
    );
    
    if (!event) return res.status(404).json({ message: 'Event not found' });
    
    // Clear any active rotating codes for this event
    await EventCode.deleteMany({ event_id: eventId });
    
    res.json({ message: 'Event closed successfully', event });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getPublicEvent = async (req, res) => {
  try {
    await syncEventStatuses();
    const event = await Event.findById(req.params.eventId).select('name venue date open_time close_time location status');
    if (!event) return res.status(404).json({ message: 'Meeting not found' });
    res.json(event);
  } catch (error) {
    res.status(400).json({ message: 'Invalid meeting link' });
  }
};