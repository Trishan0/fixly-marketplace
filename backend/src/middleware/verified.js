const requireEmailVerified = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  
  if (req.user.force_verified || req.user.is_email_verified) {
    return next();
  }
  
  return res.status(403).json({ 
    error: 'Email verification required to post jobs',
    code: 'EMAIL_NOT_VERIFIED'
  });
};

module.exports = { requireEmailVerified };
