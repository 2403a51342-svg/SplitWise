# SplitMate

Split expenses with friends, see exactly who owes whom, and settle up over UPI.

A full-stack portfolio project: a relational data model, a debt-simplification algorithm, real-time sync over WebSockets, receipt uploads, charts, dark mode, and a one-command deploy.

| | |
|---|---|
| **Frontend** | React 19, Vite, Tailwind CSS 4, Recharts, Socket.IO client |
| **Backend** | Node 22, Express 5, Socket.IO, JWT auth, Multer uploads |
| **Database** | SQLite (Node's built-in `node:sqlite`, no native build step) |
| **Money** | Stored as integer paise, never floats, so splits always add up exactly |

## Features

- **Dashboard**: a balance beam that tilts toward what you owe or are owed, per-group balances, who owes you, spending by category (donut), monthly trend (area chart), recent activity
- **Groups and expenses**: equal, exact-amount and percentage splits with a live preview of each person's share; categories with emoji; receipt photo upload
- **Debt simplification**: a "who pays whom" graph with a Simplified / Original toggle showing how many payments the algorithm saves
- **UPI settle up**: pre-filled `upi://pay` deep link plus a QR code for desktop; payments are recorded when you confirm (a web page cannot know whether a UPI payment succeeded)
- **Real time**: when a friend adds an expense or records a payment, your screen updates instantly with a toast and a highlighted row
- **Dark mode**, remembered and respecting the system setting; keyboard-friendly, reduced-motion aware, mobile-first

## Run it locally

Requires **Node 22.13 or newer**.

```bash
# 1. install both apps
npm run install:all

# 2. terminal 1: API on http://localhost:4000
npm run dev:server

# 3. terminal 2: web app on http://localhost:5173
npm run dev:client
```

Open http://localhost:5173 and click **Try the demo account** (`demo@splitmate.app` / `demo1234`). On first start the server fills an empty database with five people, three groups and about 30 expenses spread over five months, so every chart has something to show.

To see the real-time updates, open a second browser window, sign in as `priya@splitmate.app` / `demo1234` and add an expense to *Goa Trip*. The first window updates by itself.

```bash
npm test      # 24 tests: splitting, simplification, balances, permissions, seed data
              # (+ 1 end-to-end HTTP/WebSocket test that runs once dependencies are installed)
```

## How the debt simplification works

Every member's **net balance** is `what they paid − their share of every expense ± payments made or received`. The balances always sum to zero. People with a negative balance are debtors, positive are creditors. The algorithm repeatedly pairs the largest debtor with the largest creditor and settles as much as possible between them. Each step clears at least one person, so a group of *n* people needs at most *n − 1* payments, however tangled the original debts were. See `server/src/simplify.js`.

Example: A owes B ₹500 and B owes C ₹500 becomes a single payment, A pays C ₹500.

## Deploy

The server also serves the built frontend, so the whole app is **one service**.

**Render (easiest):** push this folder to GitHub, then *New → Blueprint* and pick the repo. `render.yaml` sets the build, start command and a generated `JWT_SECRET`. Free instances have no persistent disk, so remove the `disk` block; data then resets on restart and the demo data is recreated, which is fine for a portfolio demo.

**Docker:**
```bash
docker build -t splitmate .
docker run -p 4000:4000 -e JWT_SECRET=$(openssl rand -hex 32) -v splitmate:/data splitmate
```

Set `SEED_DEMO=false` for a real launch. All settings are listed in `.env.example`.

## Project structure

```
server/src/
  db.js          schema (users, groups, members, expenses, splits, settlements)
  splits.js      equal / exact / percent splitting that never loses a paisa
  simplify.js    debt simplification algorithm
  services.js    all queries and business rules (balances, dashboard, permissions)
  routes.js      REST API + upload handling + real-time notifications
  app.js         Express + Socket.IO setup, serves the built client
  seed-data.js   demo workspace
server/test/     node:test suites
client/src/
  pages/         Auth, Dashboard, Group
  components/    BalanceBeam, DebtGraph, Charts, ExpenseModal, SettleModal, ...
  context/       auth, theme, toasts, live (WebSocket) state
```

## Ideas to extend it

Recurring expenses, multi-currency, email invites for people without an account, push notifications, an Android/iOS wrapper, exporting a group as PDF or CSV.
