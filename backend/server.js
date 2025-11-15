const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { connectDB } = require('./config/database');
const { User } = require('./models/user');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());

// Initialize Database
connectDB().catch(err => {
  console.error('Failed to connect to database:', err);
  process.exit(1);
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running' });
});

// Get all users
app.get('/api/users', async (req, res) => {
  try {
    const { getDb } = require('./config/database');
    const db = getDb();
    const skip = parseInt(req.query.skip) || 0;
    const limit = parseInt(req.query.limit) || 50;

    const usersData = await db.collection('users').find().skip(skip).limit(limit).toArray();
    const users = usersData.map(userData => {
      const user = User.fromObject(userData);
      user._id = userData._id;
      return user.toSafeObject();
    });

    res.json({ status: 'success', users, count: users.length });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Create user
app.post('/api/users', async (req, res) => {
  try {
    const { getDb } = require('./config/database');
    const db = getDb();
    const { uid, first_name, last_name, email, avatar, role } = req.body;

    if (!uid || !first_name || !last_name || !email) {
      return res.status(400).json({ status: 'error', message: 'Missing required fields' });
    }

    const existingUser = await db.collection('users').findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(409).json({ status: 'error', message: 'User already exists' });
    }

    const user = new User(uid, first_name, last_name, email, avatar, role);
    const result = await db.collection('users').insertOne(user.toObject());
    user._id = result.insertedId;

    res.status(201).json({ status: 'success', message: 'User created successfully', user: user.toSafeObject() });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Get user by ID
app.get('/api/users/:userId', async (req, res) => {
  try {
    const { getDb } = require('./config/database');
    const { ObjectId } = require('mongodb');
    const db = getDb();
    const userData = await db.collection('users').findOne({ _id: new ObjectId(req.params.userId) });

    if (!userData) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    const user = User.fromObject(userData);
    user._id = userData._id;
    res.json({ status: 'success', user: user.toSafeObject() });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Update user
app.put('/api/users/:userId', async (req, res) => {
  try {
    const { getDb } = require('./config/database');
    const { ObjectId } = require('mongodb');
    const db = getDb();
    const userData = await db.collection('users').findOne({ _id: new ObjectId(req.params.userId) });

    if (!userData) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    const user = User.fromObject(userData);
    user.updateProfile(req.body);
    
    await db.collection('users').updateOne(
      { _id: new ObjectId(req.params.userId) },
      { $set: user.toObject() }
    );

    res.json({ status: 'success', message: 'User updated successfully', user: user.toSafeObject() });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Disable user
app.post('/api/users/:userId/disable', async (req, res) => {
  try {
    const { getDb } = require('./config/database');
    const { ObjectId } = require('mongodb');
    const db = getDb();
    const { reason } = req.body;
    const userData = await db.collection('users').findOne({ _id: new ObjectId(req.params.userId) });

    if (!userData) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    const user = User.fromObject(userData);
    user.addDisableRecord(reason || 'Admin disabled', null, false);
    
    await db.collection('users').updateOne(
      { _id: new ObjectId(req.params.userId) },
      { $set: user.toObject() }
    );

    res.json({ status: 'success', message: 'User disabled', user: user.toSafeObject() });
  } catch (error) {
    console.error('Error disabling user:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Enable user
app.post('/api/users/:userId/enable', async (req, res) => {
  try {
    const { getDb } = require('./config/database');
    const { ObjectId } = require('mongodb');
    const db = getDb();
    const userData = await db.collection('users').findOne({ _id: new ObjectId(req.params.userId) });

    if (!userData) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    const user = User.fromObject(userData);
    user.enableUser();
    
    await db.collection('users').updateOne(
      { _id: new ObjectId(req.params.userId) },
      { $set: user.toObject() }
    );

    res.json({ status: 'success', message: 'User enabled', user: user.toSafeObject() });
  } catch (error) {
    console.error('Error enabling user:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Delete user
app.delete('/api/users/:userId', async (req, res) => {
  try {
    const { getDb } = require('./config/database');
    const { ObjectId } = require('mongodb');
    const db = getDb();
    const result = await db.collection('users').deleteOne({ _id: new ObjectId(req.params.userId) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    res.json({ status: 'success', message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
