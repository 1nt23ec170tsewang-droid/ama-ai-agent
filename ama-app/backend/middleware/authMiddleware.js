const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Access Denied: No token provided.' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'ama_chief_of_staff_secret_key', (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or Expired Token.' });
    }
    req.user = user;
    next();
  });
};

module.exports = { authenticateToken };
