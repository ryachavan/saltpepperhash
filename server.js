// server.js
require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const db = require('./db');
const hashing = require('./utils/hashing');

const app = express();
const sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret) {
  throw new Error('SESSION_SECRET must be set.');
}

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 30,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  }
}));

const VALID_METHODS = ['plain', 'salted', 'salted_peppered'];

// ---------- Register ----------
app.post('/api/register', (req, res) => {
  const { username, password, method } = req.body;

  if (!username || !password || !method) {
    return res.status(400).json({ error: 'Username, password and method are all required.' });
  }
  if (!VALID_METHODS.includes(method)) {
    return res.status(400).json({ error: 'Invalid hashing method.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(409).json({ error: 'That username is already taken.' });
  }

  let hash, salt = null, pepperNote;

  if (method === 'plain') {
    ({ hash } = hashing.hashPlain(password));
  } else if (method === 'salted') {
    ({ hash, salt } = hashing.hashSalted(password));
  } else {
    const result = hashing.hashSaltedPeppered(password);
    hash = result.hash;
    salt = result.salt;
    pepperNote = `Your pepper was "${result.pepperUsedForDemo}". This is never written to the database.`;
  }

  db.prepare('INSERT INTO users (username, method, hash, salt) VALUES (?, ?, ?, ?)')
    .run(username, method, hash, salt);

  res.json({ success: true, method, hash, salt, pepperNote });
});

// ---------- Login ----------
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  let outcome;
  if (user.method === 'plain') {
    const r = hashing.verifyPlain(password, user.hash);
    outcome = { success: r.success, computedHash: r.computedHash };
  } else if (user.method === 'salted') {
    const r = hashing.verifySalted(password, user.salt, user.hash);
    outcome = { success: r.success, computedHash: r.computedHash };
  } else {
    const r = hashing.verifySaltedPeppered(password, user.salt, user.hash);
    outcome = { success: r.success, pepperFound: r.pepperFound, attempts: r.attempts };
  }

  if (!outcome.success) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  req.session.username = user.username;
  // Stash the just-computed verification detail so the dashboard can show
  // the brute-force steps right after login (this detail only exists in
  // memory for this session, never in the database).
  req.session.lastLogin = {
    method: user.method,
    hash: user.hash,
    salt: user.salt,
    ...outcome
  };

  res.json({ success: true });
});

// ---------- Session info for dashboard ----------
app.get('/api/session', (req, res) => {
  if (!req.session.username) {
    return res.status(401).json({ error: 'Not logged in.' });
  }
  const user = db.prepare('SELECT username, method, hash, salt, created_at FROM users WHERE username = ?')
    .get(req.session.username);

  res.json({
    username: user.username,
    method: user.method,
    hash: user.hash,
    salt: user.salt,
    createdAt: user.created_at,
    lastLogin: req.session.lastLogin || null
  });
});

// ---------- Logout ----------
app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Running at http://localhost:${PORT}`);
});
