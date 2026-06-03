const express = require('express'); 
const router = express.Router();    
const axios = require('axios'); 

const Assessment = require('../models/Assessment');
const verifyToken = require('../middleware/authMiddleware');

// server/routes/assessmentRoutes.js

router.post('/save', verifyToken, async (req, res) => {
  try {
    // 🔴 DIAGNOSTIC LOGS: Let's see what is arriving in your Render logs
    console.log("--- NEW SAVE REQUEST ARRIVED ---");
    console.log("Logged In User Data:", req.user);
    console.log("Incoming Request Body Payload:", req.body);

    const { responses, formattedQuestions } = req.body;

    if (!responses) {
      console.log("❌ CRITICAL: 'responses' was missing or empty in req.body!");
      return res.status(400).json({ error: "No answers found in request body." });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("❌ CRITICAL: process.env.OPENAI_API_KEY is completely missing on Render!");
      return res.status(500).json({ error: "Server AI configuration error." });
    }

    const aiPromptInput = formattedQuestions 
      ? JSON.stringify(formattedQuestions) 
      : JSON.stringify(responses);

    console.log("Sending payload array data to OpenAI Engine...");

    const openAIResponse = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          { 
            role: 'system', 
            content: 'You are a professional career guidance engine. Output ONLY a valid JSON object matching this exact format: {"recommended_field": string, "confidence": "Low"|"Medium"|"High", "reasoning": string, "suggested_skills": string[]}.' 
          },
          { role: 'user', content: `Analyze these questionnaire metrics: ${aiPromptInput}` }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );

    const rawContent = openAIResponse.data.choices[0].message.content;
    console.log("Raw Response back from OpenAI:", rawContent);

    const aiResult = JSON.parse(rawContent);

    const confidenceScoreMap = { "High": 92, "Medium": 74, "Low": 48 };
    const mappedScore = confidenceScoreMap[aiResult.confidence] || 80;

    const newAssessment = new Assessment({
      userId: req.user.id, // Ensure your schema uses userId matching this!
      responses: responses,
      recommendation: {
        primaryField: aiResult.recommended_field || "General Field",
        confidenceScore: mappedScore,
        analysisDate: new Date(),
        reasoning: aiResult.reasoning || "Analysis complete."
      },
      suggested_skills: aiResult.suggested_skills || []
    });

    const savedAssessment = await newAssessment.save();
    console.log("✅ SUCCESS: Saved assessment cleanly to MongoDB Cluster!");
    res.status(201).json(savedAssessment);

  } catch (err) {
    // 🔴 CHANGED: Force this to return 400 with the exact error description string
    console.error("❌ ROUTE CRASHED LOG ENTRY:", err.message);
    res.status(400).json({ 
      error: "Failed to process profile evaluation structure gracefully.",
      details: err.message 
    });
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

// 3. DELETE SINGLE RECORD ENTRY (Protected Route)
router.delete('/delete/:id', verifyToken, async (req, res) => {
  try {
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