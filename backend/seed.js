const mongoose = require('mongoose');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// Import Models
const User = require('./models/User');
const Event = require('./models/Event');
const Attendance = require('./models/Attendance');

dotenv.config();

const seedDatabase = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Clear existing data to avoid duplicates
    await User.deleteMany();
    await Event.deleteMany();
    await Attendance.deleteMany();

    // 1. Create a Test Volunteer
    const volunteer = await User.create({
      register_number: '23BCA001',
      name: 'Sridhar S',
      course: 'BCA',
      semester: 5,
      role: 'volunteer'
    });

    // 2. Create a Test Admin
    const admin = await User.create({
      register_number: 'ADMIN001',
      name: 'Admin Coordinator',
      course: 'BCA',
      semester: 5,
      role: 'admin',
      password: process.env.ADMIN_PASSWORD || 'admin123' // (In production, this will be hashed)
    });

    // 3. Create an Open Event
    const event = await Event.create({
      name: 'NSS Weekly Meeting',
      date: new Date(),
      venue: 'Presidency College',
      location: {
        latitude: 13.0489, 
        longitude: 77.5922,
        radius: 150
      },
      // Opens 1 hour ago, closes in 1 hour
      open_time: new Date(Date.now() - 60 * 60 * 1000),
      close_time: new Date(Date.now() + 60 * 60 * 1000),
      status: 'open',
      created_by: admin._id
    });

    console.log('✅ Database seeded successfully!');
    console.log(`Volunteer created: ${volunteer.name} (${volunteer.register_number})`);
    console.log(`Event created: ${event.name}`);
    
    process.exit();
  } catch (error) {
    console.error(`❌ Error seeding database: ${error.message}`);
    process.exit(1);
  }
};

seedDatabase();