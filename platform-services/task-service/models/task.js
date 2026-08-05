// services/task-service/models/Task.js

const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  organisation: { type: mongoose.Schema.Types.ObjectId, ref: 'Organisation', required: true },
  status: { type: String, enum: ['pending', 'completed', 'in-progress'], default: 'pending' },
  dueDate: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Task', taskSchema);
