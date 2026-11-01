import express from 'express';
import cors from 'cors';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { db, UPLOAD_DIR } from './db.js';
import { verifyToken } from './auth.js';
import { createRoutes } from './routes.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.join(here, '..', '..', 'client', 'dist');

export function createServer() {
  const app = express();
  const server = http.createServer(app);

  const origin = process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(',') : true;
  const io = new Server(server, { cors: { origin } });

  /* ----- real-time: every user joins one room per group (+ a private room) ----- */
  io.use((socket, next) => {
    try {
      socket.data.userId = verifyToken(socket.handshake.auth?.token ?? '').id;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const uid = socket.data.userId;
    socket.join(`user:${uid}`);
    for (const g of db.prepare('SELECT group_id FROM group_members WHERE user_id = ?').all(uid)) {
      socket.join(`group:${g.group_id}`);
    }
  });

  /* ----- HTTP ----- */
  app.disable('x-powered-by');
  app.use(cors({ origin }));
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    next();
  });
  app.use(express.json({ limit: '100kb' }));

  app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d', index: false }));
  app.use('/api', createRoutes(io));

  // In production the built React app is served from the same origin as the API.
  if (fs.existsSync(path.join(CLIENT_DIST, 'index.html'))) {
    app.use(express.static(CLIENT_DIST));
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
        return next();
      }
      res.sendFile(path.join(CLIENT_DIST, 'index.html'));
    });
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
    if (status === 500) console.error(err);
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'Receipt is too large (max 5 MB)'
        : status === 500
          ? 'Something went wrong on our side'
          : err.message;
    res.status(status).json({ error: message });
  });

  return { app, server, io };
}
