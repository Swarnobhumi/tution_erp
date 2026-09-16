require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const sequelize = require('./models/db');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Baseline security headers (dependency-free; the app is served same-origin).
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Import Cron Jobs
const initCronJobs = require('./services/cronJobs');
initCronJobs();

// Import and Train Local AI (node-nlp)
const { trainNLP } = require('./services/nlpService');
trainNLP();

// Database Connection
sequelize.sync().then(() => {
  console.log('Connected to SQLite Database');
}).catch((err) => {
  console.error('Failed to connect to SQLite Database', err);
});

// Authentication Logic
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'superadmin';
const FALLBACK_PASSWORD_HASH = 'b65e0c6e7ecbf81e14169aafb43aa6beb10ed3183d062205f7a353229e7d9e6e'; // SHA256 of the superadmin password

// A predictable JWT secret lets anyone forge admin tokens. Require it in production; if it is
// missing there, fall back to a random per-process secret (sessions won't survive a restart, but
// tokens cannot be forged) instead of shipping a publicly-known constant.
let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (IS_PRODUCTION) {
    JWT_SECRET = crypto.randomBytes(48).toString('hex');
    console.warn('[security] JWT_SECRET is not set. Using a random secret for this process only; set JWT_SECRET so sessions survive restarts.');
  } else {
    JWT_SECRET = 'tuition-erp-dev-secret';
  }
}

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  // Use env password if provided, otherwise verify against fallback hash
  let passwordMatches = false;
  if (process.env.ADMIN_PASSWORD) {
    passwordMatches = (password === process.env.ADMIN_PASSWORD);
  } else {
    const inputHash = crypto.createHash('sha256').update(password || '').digest('hex');
    passwordMatches = (inputHash === FALLBACK_PASSWORD_HASH);
  }

  if (username === ADMIN_USERNAME && passwordMatches) {
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token });
  } else {
    res.status(401).json({ message: 'Invalid credentials' });
  }
});

// Lightweight health check for uptime monitors / deploy verification.
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.post('/api/recover-credentials', (req, res) => {
  const { emailKey } = req.body;
  if (!emailKey) return res.status(400).json({ message: 'Email key is required' });
  
  try {
    const data = '52d41f9ab48dcb6b8a5a6f430ad32367:e5ddcb4b28c6bc3d9a6269cebdbb03f9b8f080eaedfaadffb39214ad4aac400f34ae2080513c56dc3cdf495e13bb05c1e8e482d9802ed874fc2e3384f1c5874c';
    const [ivHex, encrypted] = data.split(':');
    const key = crypto.scryptSync(emailKey, 'salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(ivHex, 'hex'));
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    let activeCredentials = decrypted;
    // An environment override may be in effect. Signal that it exists so the operator knows the
    // stored note can be stale, but never echo the live password back over the network.
    if (process.env.ADMIN_USERNAME || process.env.ADMIN_PASSWORD) {
      activeCredentials += "\n\n--- Active Overrides ---";
      if (process.env.ADMIN_USERNAME) {
        activeCredentials += `\nActive Username: ${process.env.ADMIN_USERNAME}`;
      }
      if (process.env.ADMIN_PASSWORD) {
        activeCredentials += `\nActive Password: (a custom password override is set in the server environment)`;
      }
    }

    res.json({ success: true, credentials: activeCredentials });
  } catch (err) {
    res.status(401).json({ success: false, message: 'Invalid Secret Key. Decryption failed.' });
  }
});

// Auth Middleware for protected routes
const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      req.user = user;
      next();
    });
  } else {
    res.status(401).json({ message: 'Unauthorized' });
  }
};

// Import Routes
const studentRoutes = require('./routes/students');
const attendanceRoutes = require('./routes/attendance');
const feeRoutes = require('./routes/fees');
const aiRoutes = require('./routes/ai');

// Use Routes (Protected)
app.use('/api/students', requireAuth, studentRoutes);
app.use('/api/attendance', requireAuth, attendanceRoutes);
app.use('/api/fees', requireAuth, feeRoutes);
app.use('/api/ai', requireAuth, aiRoutes);

// Unknown API routes return JSON, not the SPA shell (so the frontend can detect real 404s).
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Not found' });
});

// Fallback to index.html for single-page application feel
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Central error handler — never leak stack traces to clients.
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (res.headersSent) { return next(err); }
  res.status(500).json({ message: 'Something went wrong. Please try again.' });
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
