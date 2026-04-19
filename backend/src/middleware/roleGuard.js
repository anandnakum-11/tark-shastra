const ROLE_ALIASES = {
  citizen: 'citizen',
  officer: 'field_officer',
  field_officer: 'field_officer',
  department: 'department_officer',
  department_officer: 'department_officer',
  collector: 'collector',
};

function normalizeRole(role) {
  return ROLE_ALIASES[String(role || '').trim().toLowerCase()] || String(role || '').trim().toLowerCase();
}

function roleGuard(...allowedRoles) {
  const normalizedAllowedRoles = allowedRoles.map(normalizeRole);

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const currentRole = normalizeRole(req.user.role);
    if (!normalizedAllowedRoles.includes(currentRole)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${normalizedAllowedRoles.join(' or ')}. Your role: ${currentRole || 'unknown'}`,
      });
    }

    next();
  };
}

module.exports = roleGuard;
