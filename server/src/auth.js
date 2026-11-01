import jwt from 'jsonwebtoken';
import { HttpError } from './errors.js';
import { getUserById } from './services.js';

export const SECRET =
  process.env.JWT_SECRET ||
  (process.env.NODE_ENV === 'production' ? null : 'dev-only-secret-change-me');

if (!SECRET) {
  throw new Error('JWT_SECRET must be set when NODE_ENV=production');
}

export const signToken = (user) => jwt.sign({ uid: user.id }, SECRET, { expiresIn: '30d' });

export function verifyToken(token) {
  const { uid } = jwt.verify(token, SECRET);
  const user = getUserById(uid);
  if (!user) throw new Error('Unknown user');
  return user;
}

/** Express middleware: requires `Authorization: Bearer <jwt>` and sets req.user. */
export function auth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new HttpError(401, 'Please sign in'));
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    next(new HttpError(401, 'Your session has expired. Please sign in again'));
  }
}
