const mongoose = require('mongoose');

const assessmentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  responses: { type: Object, required: true },
  recommendation: { type: Object, required: true },
  suggested_skills: { type: [String], default: [] }, // ✅ Added explicitly as an array of strings
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Assessment', assessmentSchema);