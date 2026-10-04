const jwt = require('jsonwebtoken');

const adminAuth = async (req, res, next) => {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice(7)
    : '';

  if (!token) {
    return res.status(401).json({ message: 'Admin authentication required' });
  }

  try {
    req.admin = jwt.verify(token, process.env.JWT_SECRET || 'change-this-jwt-secret');
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Admin session expired or invalid' });
  }
};

module.exports = adminAuth;