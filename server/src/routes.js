import express from 'express';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { UPLOAD_DIR } from './db.js';
import { HttpError } from './errors.js';
import { auth, signToken } from './auth.js';
import * as svc from './services.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UPI_RE = /^[a-zA-Z0-9.\-_]{2,64}@[a-zA-Z0-9]{2,32}$/;
const IMAGE_EXT = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif' };

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    // Random file names: nobody can guess a receipt URL, and user input never touches the path.
    filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${IMAGE_EXT[file.mimetype]}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) =>
    IMAGE_EXT[file.mimetype]
      ? cb(null, true)
      : cb(new HttpError(400, 'Receipt must be a PNG, JPG, WebP or GIF image')),
});

function clean(value, label, { max = 100 } = {}) {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) throw new HttpError(400, `${label} is required`);
  if (s.length > max) throw new HttpError(400, `${label} is too long`);
  return s;
}

const firstName = (name) => name.split(' ')[0];

export function createRoutes(io) {
  const r = express.Router();

  /** Tell everyone in a group that something changed (they re-fetch + show a toast). */
  const notify = (groupId, actor, payload) =>
    io.to(`group:${groupId}`).emit('group:changed', {
      groupId,
      actorId: actor.id,
      actorName: actor.name,
      at: Date.now(),
      ...payload,
    });

  /** Loads :id, checks the caller is a member, and exposes it as req.gid. */
  const groupParam = (req, _res, next) => {
    const gid = Number(req.params.id);
    if (!Number.isInteger(gid)) return next(new HttpError(404, 'Group not found'));
    svc.assertMember(gid, req.user.id);
    req.gid = gid;
    next();
  };

  r.get('/health', (_req, res) => res.json({ ok: true }));

  /* ------------------------------------------------------------- auth */

  r.post('/auth/register', (req, res) => {
    const name = clean(req.body?.name, 'Name', { max: 60 });
    const email = clean(req.body?.email, 'Email', { max: 120 }).toLowerCase();
    if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Enter a valid email address');
    const password = String(req.body?.password ?? '');
    if (password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters');
    if (svc.getUserByEmail(email)) throw new HttpError(409, 'An account with this email already exists');

    const user = svc.createUser({ name, email, passwordHash: bcrypt.hashSync(password, 10) });
    res.status(201).json({ token: signToken(user), user: svc.publicUser(user) });
  });

  r.post('/auth/login', (req, res) => {
    const email = String(req.body?.email ?? '');
    const password = String(req.body?.password ?? '');
    const user = email ? svc.getUserByEmail(email) : null;
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      throw new HttpError(401, 'Incorrect email or password');
    }
    res.json({ token: signToken(user), user: svc.publicUser(user) });
  });

  r.get('/me', auth, (req, res) => res.json({ user: svc.publicUser(req.user) }));

  r.patch('/me', auth, (req, res) => {
    const patch = {};
    if (req.body?.name !== undefined) patch.name = clean(req.body.name, 'Name', { max: 60 });
    if (req.body?.upiId !== undefined) {
      const upi = String(req.body.upiId).trim();
      if (upi && !UPI_RE.test(upi)) {
        throw new HttpError(400, 'That does not look like a UPI ID (for example: name@okhdfcbank)');
      }
      patch.upiId = upi || null;
    }
    res.json({ user: svc.publicUser(svc.updateUser(req.user.id, patch)) });
  });

  /* -------------------------------------------------------- dashboard */

  r.get('/dashboard', auth, (req, res) => res.json(svc.getDashboard(req.user.id)));

  /* ----------------------------------------------------------- groups */

  r.post('/groups', auth, (req, res) => {
    const name = clean(req.body?.name, 'Group name', { max: 40 });
    const emoji = String(req.body?.emoji || '💸').slice(0, 8);
    const memberEmails = Array.isArray(req.body?.memberEmails)
      ? req.body.memberEmails.map(String).slice(0, 30)
      : [];

    const { id, added, notFound } = svc.createGroup(req.user.id, { name, emoji, memberEmails });

    // Put every connected device of the new members into the group's live room.
    io.in(`user:${req.user.id}`).socketsJoin(`group:${id}`);
    for (const uid of added) {
      io.in(`user:${uid}`).socketsJoin(`group:${id}`);
      io.to(`user:${uid}`).emit('group:changed', {
        groupId: id,
        kind: 'group',
        actorId: req.user.id,
        actorName: req.user.name,
        at: Date.now(),
        text: `${firstName(req.user.name)} added you to “${name}”`,
      });
    }
    res.status(201).json({ id, notFound });
  });

  r.get('/groups/:id', auth, groupParam, (req, res) => res.json(svc.getGroupDetail(req.gid)));

  r.post('/groups/:id/members', auth, groupParam, (req, res) => {
    const email = clean(req.body?.email, 'Email', { max: 120 });
    const user = svc.addMember(req.gid, email);
    io.in(`user:${user.id}`).socketsJoin(`group:${req.gid}`);
    const { group } = svc.getGroupDetail(req.gid);
    notify(req.gid, req.user, {
      kind: 'member',
      text: `${firstName(req.user.name)} added ${firstName(user.name)} to “${group.name}”`,
    });
    res.status(201).json({ user: svc.publicUser(user) });
  });

  /* --------------------------------------------------------- expenses */

  r.post('/groups/:id/expenses', auth, groupParam, upload.single('receipt'), (req, res) => {
    const body = req.body ?? {};
    try {
      let participants = body.participants;
      if (typeof participants === 'string') {
        try {
          participants = JSON.parse(participants);
        } catch {
          throw new HttpError(400, 'Invalid list of people for this split');
        }
      }
      participants = (Array.isArray(participants) ? participants : []).map((p) => ({
        userId: Number(p.userId),
        value: p.value === undefined ? undefined : Number(p.value),
      }));

      const id = svc.addExpense(req.gid, req.user.id, {
        description: body.description,
        amount: Number(body.amount),
        category: body.category,
        paidBy: Number(body.paidBy),
        splitType: body.splitType,
        participants,
        date: body.date,
        receiptUrl: req.file ? `/uploads/${req.file.filename}` : null,
      });

      notify(req.gid, req.user, {
        kind: 'expense',
        expenseId: id,
        text: `${firstName(req.user.name)} added “${String(body.description).trim()}” · ${svc.formatINR(Number(body.amount))}`,
      });
      res.status(201).json({ id });
    } catch (err) {
      // Don't leave an orphaned upload behind when validation fails.
      if (req.file) fs.rm(req.file.path, { force: true }, () => {});
      throw err;
    }
  });

  r.delete('/expenses/:id', auth, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new HttpError(404, 'Expense not found');
    const { groupId, description } = svc.deleteExpense(id, req.user.id);
    notify(groupId, req.user, {
      kind: 'expense-deleted',
      text: `${firstName(req.user.name)} deleted “${description}”`,
    });
    res.json({ ok: true });
  });

  /* ------------------------------------------------------ settlements */

  r.post('/groups/:id/settlements', auth, groupParam, (req, res) => {
    const fromUser = Number(req.body?.fromUser);
    const toUser = Number(req.body?.toUser);
    const amount = Number(req.body?.amount);
    const id = svc.addSettlement({
      groupId: req.gid,
      actorId: req.user.id,
      fromUser,
      toUser,
      amount,
    });
    const from = svc.getUserById(fromUser);
    const to = svc.getUserById(toUser);
    notify(req.gid, req.user, {
      kind: 'settlement',
      text: `${firstName(from.name)} paid ${firstName(to.name)} ${svc.formatINR(amount)}`,
    });
    res.status(201).json({ id });
  });

  r.use((_req, _res, next) => next(new HttpError(404, 'Not found')));
  return r;
}
