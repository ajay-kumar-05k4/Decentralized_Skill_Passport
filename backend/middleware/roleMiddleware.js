// Role-based access control - part of "User & Role Management"
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401);
      return next(new Error('Not authorized'));
    }
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403);
      return next(
        new Error(`Role '${req.user.role}' is not permitted to perform this action`)
      );
    }
    next();
  };
};

module.exports = { authorizeRoles };
