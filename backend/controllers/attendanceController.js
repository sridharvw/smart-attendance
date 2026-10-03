const User = require('../models/User');
const Event = require('../models/Event');
const Attendance = require('../models/Attendance');
const EventCode = require('../models/EventCode');
const calculateDistance = require('../utils/geoDistance');
const isWithinReliableGeofence = require('../utils/isWithinReliableGeofence');

exports.getDirectory = async (req, res) => {
  try {
    const directory = await User.aggregate([
      { $match: { role: 'volunteer' } },
      {
        $lookup: {
          from: 'attendances',
          let: { userId: '$_id' },
          pipeline: [
            { $match: { $expr: { $and: [
              { $eq: ['$user_id', '$$userId'] },
              { $eq: ['$status', 'present'] }
            ] } } },
            {
              $lookup: {
                from: 'events',
                localField: 'event_id',
                foreignField: '_id',
                as: 'event'
              }
            },
            { $unwind: { path: '$event', preserveNullAndEmptyArrays: true } },
            {
              $project: {
                createdAt: 1,
                device_id: 1,
                hours: {
                  $cond: [
                    { $and: ['$event.open_time', '$event.close_time'] },
                    { $divide: [{ $subtract: ['$event.close_time', '$event.open_time'] }, 3600000] },
                    1
                  ]
                }
              }
            }
          ],
          as: 'attendance'
        }
      },
      {
        $project: {
          _id: 1,
          name: 1,
          registerNumber: '$register_number',
          course: 1,
          semester: 1,
          totalAttendance: { $size: '$attendance' },
          totalHours: { $round: [{ $sum: '$attendance.hours' }, 2] },
          lastAttendance: { $max: '$attendance.createdAt' },
          deviceIds: {
            $setUnion: [
              { $map: { input: '$attendance', as: 'record', in: '$$record.device_id' } },
              []
            ]
          }
        }
      },
      {
        $project: {
          _id: 1,
          name: 1,
          registerNumber: 1,
          course: 1,
          semester: 1,
          totalAttendance: 1,
          totalHours: 1,
          lastAttendance: 1,
          deviceIds: {
            $filter: { input: '$deviceIds', as: 'deviceId', cond: { $ne: ['$$deviceId', null] } }
          }
        }
      },
      { $sort: { totalAttendance: -1, name: 1 } }
    ]);

    res.json(directory);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// 1. Fetch volunteer details (Used for old flow, keeping for safety)
exports.getVolunteer = async (req, res) => {
  try {
    const { register_number } = req.params;
    const user = await User.findOne({ register_number: register_number.toUpperCase() });
    
    if (!user) {
      return res.status(404).json({ message: 'Volunteer not found' });
    }
    res.json({ id: user._id, name: user.name, course: user.course, semester: user.semester });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.markAttendance = async (req, res) => {
  try {
    const { regNumber, name, course, section, event_id, latitude, longitude, accuracy, device_id, code, token } = req.body;

    const gpsAccuracy = typeof accuracy === 'number' ? accuracy : NaN;
    const numericLatitude = Number(latitude);
    const numericLongitude = Number(longitude);
    const hasValidCode = typeof code === 'string' && /^\d{6}$/.test(code);
    const hasValidToken = typeof token === 'string' && /^[a-f0-9]{64}$/i.test(token);
    if (!regNumber || !name || !course || !section || (!hasValidCode && !hasValidToken) || (hasValidCode && hasValidToken) || !device_id || !Number.isFinite(numericLatitude) || numericLatitude < -90 || numericLatitude > 90 || !Number.isFinite(numericLongitude) || numericLongitude < -180 || numericLongitude > 180 || !Number.isFinite(gpsAccuracy) || gpsAccuracy < 0 || gpsAccuracy > 100) {
      return res.status(400).json({ message: 'Complete student details and a valid location with GPS accuracy are required' });
    }
    
    // Ensure event is open
    const event = await Event.findById(event_id);
    const now = new Date();
    const withinEventWindow = event && now >= event.open_time && now <= event.close_time;
    if (!event || event.status === 'closed' || !withinEventWindow) {
      return res.status(400).json({ message: 'Attendance is closed or event not found' });
    }

    if (event.status === 'upcoming') {
      event.status = 'open';
      await event.save();
    }

    // Verify rotating code
    const validCode = await EventCode.findOne({
      event_id: event._id,
      ...(hasValidToken ? { token } : { code }),
      valid_from: { $lte: now },
      valid_until: { $gte: now }
    });

    if (!validCode) {
      return res.status(400).json({ message: 'The meeting QR or code has expired or is invalid. Scan or enter the current credential and try again.' });
    }

    const distance = calculateDistance(
      event.location.latitude,
      event.location.longitude,
      numericLatitude,
      numericLongitude
    );
    if (!isWithinReliableGeofence(distance, gpsAccuracy, event.location.radius)) {
      return res.status(403).json({ message: 'Check-in denied. Move inside the meeting area and retry with an accurate GPS signal.' });
    }

    // Find or auto-create user
    let user = await User.findOne({ register_number: regNumber.toUpperCase() });
    if (!user) {
      user = await User.create({
        register_number: regNumber.toUpperCase(),
        name: name,
        course: course,
        semester: section, 
        role: 'volunteer'
      });
    }

    // Prevent duplicate attendance for the same user
    const existing = await Attendance.findOne({ user_id: user._id, event_id });
    if (existing) {
      return res.status(400).json({ message: 'Attendance already recorded for this event' });
    }

    // Calculate location distance
    let status = 'present';

    // Check for device fingerprint anomaly (shared device check)
    const existingDevice = await Attendance.findOne({ event_id, device_id });
    if (existingDevice && existingDevice.user_id.toString() !== user._id.toString()) {
      status = 'needs_review';
    }

    // Save record
    const attendance = await Attendance.create({
      event_id,
      user_id: user._id,
      status,
      location: { latitude, longitude, accuracy: gpsAccuracy, distance_from_venue: distance },
      device_id
    });

    res.status(201).json({ 
      message: 'Attendance processed', 
      status, 
      distance,
      user: { name: user.name, regNumber: user.register_number }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.addManualAttendance = async (req, res) => {
  try {
    const { event_id, regNumber, name, course, section, status = 'present' } = req.body;
    if (!event_id || !regNumber || !name || !course || !section || !['present', 'absent'].includes(status)) {
      return res.status(400).json({ message: 'Meeting, volunteer details, and a valid attendance status are required' });
    }

    const event = await Event.findById(event_id);
    if (!event) return res.status(404).json({ message: 'Meeting not found' });

    const normalizedRegNumber = regNumber.trim().toUpperCase();
    let user = await User.findOne({ register_number: normalizedRegNumber });
    if (!user) {
      user = await User.create({
        register_number: normalizedRegNumber,
        name: name.trim(),
        course: course.trim(),
        semester: section.trim(),
        role: 'volunteer'
      });
    }

    let attendance = await Attendance.findOne({ event_id, user_id: user._id });
    const isUpdate = Boolean(attendance);
    if (attendance) {
      attendance.status = status;
      attendance.source = 'admin';
      attendance.override_reason = 'Manually recorded by admin';
      await attendance.save();
    } else {
      attendance = await Attendance.create({
        event_id,
        user_id: user._id,
        status,
        source: 'admin',
        override_reason: 'Manually recorded by admin'
      });
    }

    await attendance.populate('user_id', 'name register_number course semester');
    res.status(isUpdate ? 200 : 201).json(attendance);
  } catch (error) {
    res.status(500).json({ message: 'Could not save manual attendance', error: error.message });
  }
};

// 3. Fetch live attendance for the admin dashboard
exports.getLiveAttendance = async (req, res) => {
  try {
    const { eventId } = req.params;
    const attendances = await Attendance.find({ event_id: eventId })
      .populate('user_id', 'name register_number')
      .sort({ createdAt: -1 }); // Newest first
    
    res.json(attendances);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// 4. Update attendance status (Accept/Reject review)
exports.updateAttendanceStatus = async (req, res) => {
  try {
    const { attendanceId } = req.params;
    const { status, override_reason } = req.body; // Extract the new reason field

    if (!['present', 'absent', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    const updated = await Attendance.findByIdAndUpdate(
      attendanceId,
      { 
        status, 
        override_reason: override_reason || 'No reason provided' 
      },
      { returnDocument: 'after' }
    ).populate('user_id', 'name register_number course semester');

    if (!updated) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    res.json({ message: `Attendance marked as ${status}`, updated });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// 5. Export event attendance as a CSV file
exports.exportAttendanceCSV = async (req, res) => {
  try {
    const { eventId } = req.params;
    const attendances = await Attendance.find({ event_id: eventId })
      .populate('user_id', 'name register_number course semester');

    // Added Admin Notes column
    let csv = 'Register Number,Name,Course,Semester,Status,Distance (m),Device ID,Admin Notes,Check-in Time\n';
    
    attendances.forEach(a => {
      const reg = a.user_id?.register_number || 'N/A';
      const name = `"${a.user_id?.name || 'Unknown'}"`;
      const course = a.user_id?.course || 'N/A';
      const sem = `"${a.user_id?.semester || 'N/A'}"`;
      const status = a.status;
      const dist = a.location?.distance_from_venue || 0;
      const device = a.device_id || 'N/A';
      const notes = `"${a.override_reason || ''}"`; // Extract notes safely
      const time = new Date(a.createdAt).toISOString();

      csv += `${reg},${name},${course},${sem},${status},${dist},${device},${notes},${time}\n`;
    });

    res.header('Content-Type', 'text/csv');
    res.attachment(`attendance-report-${eventId}.csv`);
    return res.send(csv);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};