// server/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  // Get token from headers
  const token = req.header('Authorization');
  if (!token) return res.status(401).json({ error: "Access Denied. No token provided." });

  try {
    // Verify the token and extract the user's ID
    const verified = jwt.verify(token.replace("Bearer ", ""), process.env.JWT_SECRET);
    req.user = verified; // Attach the user ID to the request
    next(); // Move to the next function
  } catch (err) {
    res.status(400).json({ error: "Invalid Token" });
  }
};

module.exports = verifyToken;