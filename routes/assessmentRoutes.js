const express = require('express'); 
const router = express.Router();    
const axios = require('axios'); 

const Assessment = require('../models/Assessment');
const verifyToken = require('../middleware/authMiddleware');

router.post('/save', verifyToken, async (req, res) => {
  try {
    const { responses, formattedQuestions } = req.body;

    if (!responses) {
      return res.status(400).json({ error: "No answers found in request body." });
    }

    // Ensure the system key is configured on Render
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("Missing process.env.OPENAI_API_KEY configuration on backend platform.");
      return res.status(500).json({ error: "Server AI configuration error." });
    }

    // Fallback compilation if formattedQuestions wasn't provided directly by the frontend request
    const aiPromptInput = formattedQuestions 
      ? JSON.stringify(formattedQuestions) 
      : JSON.stringify(responses);

    // Securely call OpenAI from Node.js (Bypasses browser CORS restrictions cleanly)
    const openAIResponse = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          { 
            role: 'system', 
            content: 'You are a professional career guidance engine. Given a user\'s metrics layout questionnaire response structure, output ONLY a valid JSON object matching this exact format: {"recommended_field": string, "confidence": "Low"|"Medium"|"High", "reasoning": string, "suggested_skills": string[]}.' 
          },
          { 
            role: 'user', 
            content: `Analyze these questionnaire metric records carefully: ${aiPromptInput}` 
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );

    // Extract content payload from the choice index anchor point
    const rawContent = openAIResponse.data.choices[0].message.content;
    const aiResult = JSON.parse(rawContent);

    // Convert string confidence to numeric score metric value for database schema mapping consistency
    const confidenceScoreMap = { "High": 92, "Medium": 74, "Low": 48 };
    const mappedScore = confidenceScoreMap[aiResult.confidence] || 80;

    // Construct unified dynamic document record layout matching your validation schema fields
    const newAssessment = new Assessment({
      userId: req.user.id,
      responses: responses,
      recommendation: {
        primaryField: aiResult.recommended_field || "General Field",
        confidenceScore: mappedScore,
        analysisDate: new Date(),
        reasoning: aiResult.reasoning || "Analysis complete based on profile indicators."
      },
      suggested_skills: aiResult.suggested_skills || []
    });

    const savedAssessment = await newAssessment.save();
    res.status(201).json(savedAssessment);

  } catch (err) {
    console.error("OpenAI processing or DB entry crash tracking logs:", err.message);
    res.status(500).json({ error: "Failed to process profile evaluation structure gracefully." });
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