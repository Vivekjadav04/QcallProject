const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
  // Get token from header
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");
    
    // 🟢 DEBUG LOG: Helps confirm the token is working
    // console.log("[AUTH] Valid Request from User ID:", decoded.id);

    req.user = decoded; // Attaches user ID to the request
    next();
  } catch (err) {
    console.error("[AUTH] Token Error:", err.message);
    res.status(401).json({ msg: 'Token is not valid' });
  }
};