// server/routes/assessmentRoutes.js
const express = require('express'); // 🔴 MUST BE HERE
const router = express.Router();    // 🔴 MUST BE HERE

const Assessment = require('../models/Assessment');
const verifyToken = require('../middleware/authMiddleware');

// 1. SAVE NEW ASSESSMENT (Protected Route)
router.post('/save', verifyToken, async (req, res) => {
  try {
    const { responses, recommendation, suggested_skills } = req.body;
    
    const newAssessment = new Assessment({
      userId: req.user.id,
      responses,
      recommendation,
      suggested_skills: suggested_skills || [] 
    });

    const savedAssessment = await newAssessment.save();
    res.status(201).json(savedAssessment);
  } catch (err) {
    res.status(500).json({ error: "Failed to save assessment" });
  }
});

// 2. GET USER'S HISTORY (Protected Route)
router.get('/history', verifyToken, async (req, res) => {
  try {
    const history = await Assessment.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch history" });
  }
});
router.delete('/delete/:id', verifyToken, async (req, res) => {
  try {
    // Find the assessment by ID and ensure it belongs to the logged-in user
    const assessment = await Assessment.findOne({ _id: req.params.id, userId: req.user.id });
    
    if (!assessment) {
      return res.status(404).json({ error: "Assessment record not found or unauthorized" });
    }

    await Assessment.findByIdAndDelete(req.params.id);
    res.json({ message: "Assessment record deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete assessment record" });
  }
});

module.exports = router;