import jwt from 'jsonwebtoken';

export function auth(req, _res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const fallbackRole = req.headers['x-role'];

  let user = { role: 'PROVIDER' };

  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      if (payload?.role) user.role = payload.role;
    } catch (_) {}
  } else if (fallbackRole && ['PROVIDER', 'EDITOR'].includes(fallbackRole)) {
    user.role = fallbackRole;
  }

  req.user = user;
  next();
}

export function requireEditor(user) {
  if (user.role !== 'EDITOR') {
    const err = new Error('Forbidden: editor role required');
    err.statusCode = 403;
    throw err;
  }
}
