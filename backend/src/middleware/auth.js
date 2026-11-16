'use strict';
const jwt = require('jsonwebtoken');
const config = require('../config');
const { unauthorized, forbidden } = require('../errors');

const ACCESS_TTL = '15m', REFRESH_TTL = '7d';
const cookieBase = { httpOnly: true, sameSite: 'strict', secure: config.isProd, path: '/' };

function signAccess(user) { return jwt.sign({ sub: user.id, role: user.role, pid: user.profileId }, config.jwtSecret, { expiresIn: ACCESS_TTL }); }
function signRefresh(user) { return jwt.sign({ sub: user.id, typ: 'refresh' }, config.jwtRefreshSecret, { expiresIn: REFRESH_TTL }); }

function setSession(res, user) {
  res.cookie('mm_at', signAccess(user), { ...cookieBase, maxAge: 15 * 60 * 1000 });
  res.cookie('mm_rt', signRefresh(user), { ...cookieBase, maxAge: 7 * 864e5, path: '/api/auth' });
}
function clearSession(res) { res.clearCookie('mm_at', cookieBase); res.clearCookie('mm_rt', { ...cookieBase, path: '/api/auth' }); }

function authenticate(req, _res, next) {
  const header = req.headers.authorization;
  const token = header && header.startsWith('Bearer ') ? header.slice(7) : req.cookies && req.cookies.mm_at;
  if (!token) return next(unauthorized());
  try {
    const p = jwt.verify(token, config.jwtSecret);
    req.user = { id: p.sub, role: p.role, profileId: p.pid };
    next();
  } catch { next(unauthorized('Session expired or invalid')); }
}

const requireRole = (...roles) => (req, _res, next) => (roles.includes(req.user.role) ? next() : next(forbidden('Your role cannot perform this action')));

module.exports = { authenticate, requireRole, setSession, clearSession, signRefresh, jwt };
