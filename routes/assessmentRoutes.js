const express = require('express'); 
const router = express.Router();    
const axios = require('axios'); 

const Assessment = require('../models/Assessment');
const verifyToken = require('../middleware/authMiddleware');

// server/routes/assessmentRoutes.js

// server/routes/assessmentRoutes.js

router.post('/save', verifyToken, async (req, res) => {
  try {
    const { responses, formattedQuestions } = req.body;

    if (!responses) {
      return res.status(400).json({ error: "No answers found in request body." });
    }

    // 🔴 HARDCODED KEY: Paste your active OpenAI key directly here on the backend 
    const apiKey = "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";
    const apiModel = "gpt-4o-mini";

    const aiPromptInput = formattedQuestions 
      ? JSON.stringify(formattedQuestions) 
      : JSON.stringify(responses);

    // Call OpenAI directly from Node.js
    const openAIResponse = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: apiModel,
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
    const aiResult = JSON.parse(rawContent);

    const confidenceScoreMap = { "High": 92, "Medium": 74, "Low": 48 };
    const mappedScore = confidenceScoreMap[aiResult.confidence] || 80;

    const newAssessment = new Assessment({
      userId: req.user.id, 
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
    res.status(201).json(savedAssessment);

  } catch (err) {
    console.error("Backend error details:", err.message);
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