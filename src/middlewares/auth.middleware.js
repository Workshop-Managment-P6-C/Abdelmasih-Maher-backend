const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const authorization = req.headers.authorization;
  const token = authorization && authorization.startsWith('Bearer ')
    ? authorization.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Access token is missing or invalid', requestId: `req_${Date.now()}` } });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'secret_key');
    return next();
  } catch (error) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Access token is missing or invalid', requestId: `req_${Date.now()}` } });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!roles.length) return next();
  if (!req.user) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required', requestId: `req_${Date.now()}` } });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions', requestId: `req_${Date.now()}` } });
  }
  return next();
};

const ROLES = Object.freeze({
  WORKSHOP: ['WORKSHOP_MANAGER', 'SERVICE_ADVISOR', 'TECHNICIAN', 'QUALITY_CHECKER', 'AUDITOR', 'CUSTOMER'],
  WORKSHOP_MANAGERS: ['WORKSHOP_MANAGER'],
  JOB_COORDINATORS: ['WORKSHOP_MANAGER', 'SERVICE_ADVISOR'],
  JOB_EXECUTION: ['WORKSHOP_MANAGER', 'SERVICE_ADVISOR', 'TECHNICIAN', 'QUALITY_CHECKER'],
  TECHNICIANS: ['TECHNICIAN'],
  QUALITY: ['WORKSHOP_MANAGER', 'QUALITY_CHECKER'],
  INVENTORY: ['WORKSHOP_MANAGER', 'STOREKEEPER', 'PROCUREMENT', 'AUDITOR'],
  PROCUREMENT: ['WORKSHOP_MANAGER', 'PROCUREMENT'],
  FINANCE: ['WORKSHOP_MANAGER', 'FINANCE_VIEWER', 'AUDITOR'],
  TRAINING_MANAGERS: ['WORKSHOP_MANAGER', 'TRAINING_SUPERVISOR'],
  TRAINING_STAFF: ['WORKSHOP_MANAGER', 'TRAINING_SUPERVISOR', 'MENTOR'],
  TRAINING_USERS: ['WORKSHOP_MANAGER', 'TRAINING_SUPERVISOR', 'MENTOR', 'STUDENT'],
});

module.exports = {
  authenticateToken,
  authorize,
  ROLES,
};
