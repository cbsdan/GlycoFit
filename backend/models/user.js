onst { ObjectId } = require('mongodb');
const { getDb } = require('../config/database');
const { logDatabaseOperation } = require('../middleware/logging_middleware');

class DisableRecord {
  constructor(reason, endDate = null, isPermanent = false) {
    this.start_date = new Date();
    this.end_date = endDate;
    this.reason = reason;
    this.is_permanent = isPermanent;
    this.is_active = true;
    this.created_at = new Date();
  }

  toObject() {
    return {
      start_date: this.start_date,
      end_date: this.end_date,
      reason: this.reason,
      is_permanent: this.is_permanent,
      is_active: this.is_active,
      created_at: this.created_at
    };
  }
}

class User {
  constructor(uid, firstName, lastName, email, avatar = null, role = 'user') {
    this.uid = uid;
    this.first_name = firstName;
    this.last_name = lastName;
    this.email = email.toLowerCase().trim();
    this.role = role;
    this.avatar = avatar || { public_id: null, url: null };
    this.push_tokens = [];
    this.enable_push_notifications = true;
    this.permission_token = null;
    this.multi_factor_enabled = false;
    this.disable_history = [];
    this.created_at = new Date();
    this.updated_at = new Date();
  }

  toObject() {
    return {
      uid: this.uid,
      first_name: this.first_name,
      last_name: this.last_name,
      email: this.email,
      role: this.role,
      avatar: this.avatar,
      push_tokens: this.push_tokens,
      enable_push_notifications: this.enable_push_notifications,
      permission_token: this.permission_token,
      multi_factor_enabled: this.multi_factor_enabled,
      disable_history: this.disable_history,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }

  static fromObject(data) {
    const user = new User(
      data.uid,
      data.first_name,
      data.last_name,
      data.email,
      data.avatar || { public_id: null, url: null },
      data.role || 'user'
    );
    user.push_tokens = data.push_tokens || [];
    user.enable_push_notifications = data.enable_push_notifications ?? true;
    user.permission_token = data.permission_token || null;
    user.multi_factor_enabled = data.multi_factor_enabled ?? false;
    user.disable_history = data.disable_history || [];
    user.created_at = data.created_at || new Date();
    user.updated_at = data.updated_at || new Date();
    return user;
  }

  isCurrentlyDisabled() {
    if (!this.disable_history.length) return false;

    const now = new Date();
    for (const record of this.disable_history) {
      if (!record.is_active) continue;
      if (record.is_permanent) return true;
      if (record.end_date && record.end_date > now) return true;
    }
    return false;
  }

  getCurrentDisableRecord() {
    if (!this.disable_history.length) return null;

    const now = new Date();
    for (const record of this.disable_history) {
      if (!record.is_active) continue;
      if (record.is_permanent) return record;
      if (record.end_date && record.end_date > now) return record;
    }
    return null;
  }

  addDisableRecord(reason, endDate = null, isPermanent = false) {
    for (const record of this.disable_history) {
      if (record.is_active) record.is_active = false;
    }
    const newRecord = new DisableRecord(reason, endDate, isPermanent);
    this.disable_history.push(newRecord.toObject());
    this.updated_at = new Date();
    return newRecord;
  }

  enableUser(reason = 'User enabled') {
    for (const record of this.disable_history) {
      if (record.is_active) {
        record.is_active = false;
        record.end_date = new Date();
      }
    }
    const enableRecord = {
      start_date: new Date(),
      end_date: null,
      reason,
      is_permanent: false,
      is_active: false,
      action: 'enabled',
      created_at: new Date()
    };
    this.disable_history.push(enableRecord);
    this.updated_at = new Date();
  }

  async save() {
    try {
      const db = getDb();
      const userData = this.toObject();

      if (this._id) {
        const result = await db.collection('users').updateOne(
          { _id: this._id },
          { $set: userData }
        );
        logDatabaseOperation('update_one', 'users', { _id: this._id }, result);
        return result;
      } else {
        const result = await db.collection('users').insertOne(userData);
        this._id = result.insertedId;
        logDatabaseOperation('insert_one', 'users', userData, result);
        return result;
      }
    } catch (error) {
      console.error(`Error saving user: ${error.message}`);
      throw error;
    }
  }

  static async findByUid(uid) {
    try {
      const db = getDb();
      const userData = await db.collection('users').findOne({ uid });
      logDatabaseOperation('find_one', 'users', { uid }, userData);
      
      if (userData) {
        const user = User.fromObject(userData);
        user._id = userData._id;
        return user;
      }
      return null;
    } catch (error) {
      console.error(`Error finding user by UID: ${error.message}`);
      throw error;
    }
  }

  static async findByEmail(email) {
    try {
      const db = getDb();
      const userData = await db.collection('users').findOne({ email: email.toLowerCase().trim() });
      logDatabaseOperation('find_one', 'users', { email }, userData);
      
      if (userData) {
        const user = User.fromObject(userData);
        user._id = userData._id;
        return user;
      }
      return null;
    } catch (error) {
      console.error(`Error finding user by email: ${error.message}`);
      throw error;
    }
  }

  static async findById(userId) {
    try {
      const db = getDb();
      const userData = await db.collection('users').findOne({ _id: new ObjectId(userId) });
      logDatabaseOperation('find_one', 'users', { _id: userId }, userData);
      
      if (userData) {
        const user = User.fromObject(userData);
        user._id = userData._id;
        return user;
      }
      return null;
    } catch (error) {
      console.error(`Error finding user by ID: ${error.message}`);
      throw error;
    }
  }

  static async getAllUsers(skip = 0, limit = 50) {
    try {
      const db = getDb();
      const usersData = await db.collection('users').find().skip(skip).limit(limit).toArray();
      logDatabaseOperation('find', 'users', { skip, limit }, usersData);
      
      return usersData.map(userData => {
        const user = User.fromObject(userData);
        user._id = userData._id;
        return user;
      });
    } catch (error) {
      console.error(`Error getting all users: ${error.message}`);
      throw error;
    }
  }

  addPushToken(token) {
    if (!this.push_tokens.includes(token)) {
      this.push_tokens.push(token);
      this.updated_at = new Date();
    }
  }

  removePushToken(token) {
    const index = this.push_tokens.indexOf(token);
    if (index > -1) {
      this.push_tokens.splice(index, 1);
      this.updated_at = new Date();
    }
  }

  updateProfile(updates = {}) {
    const allowedFields = ['first_name', 'last_name', 'avatar', 'enable_push_notifications', 'permission_token'];
    for (const [field, value] of Object.entries(updates)) {
      if (allowedFields.includes(field)) {
        this[field] = value;
      }
    }
    this.updated_at = new Date();
  }

  toSafeObject() {
    return {
      id: this._id ? this._id.toString() : '',
      uid: this.uid,
      first_name: this.first_name,
      last_name: this.last_name,
      email: this.email,
      role: this.role,
      avatar: this.avatar,
      enable_push_notifications: this.enable_push_notifications,
      multi_factor_enabled: this.multi_factor_enabled,
      is_disabled: this.isCurrentlyDisabled(),
      created_at: this.created_at?.toISOString() || null,
      updated_at: this.updated_at?.toISOString() || null
    };
  }
}

module.exports = { User, DisableRecord };
