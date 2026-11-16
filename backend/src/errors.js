'use strict';
class AppError extends Error {
  constructor(status, message, details) { super(message); this.status = status; this.details = details; }
}
const bad = (m, d) => new AppError(400, m, d);
const unauthorized = (m = 'Authentication required') => new AppError(401, m);
const forbidden = (m = 'You do not have access to this resource') => new AppError(403, m);
const notFound = (m = 'Not found') => new AppError(404, m);
const conflict = (m) => new AppError(409, m);
module.exports = { AppError, bad, unauthorized, forbidden, notFound, conflict };
