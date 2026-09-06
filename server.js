require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const sequelize = require('./models/db');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'superadmin';
const FALLBACK_PASSWORD_HASH = 'b65e0c6e7ecbf81e14169aafb43aa6beb10ed3183d062205f7a353229e7d9e6e'; // SHA256 of the superadmin password
const AUTH_TOKEN = 'tuition-erp-auth-token-12345'; // Hardcoded for simplicity

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
    res.json({ token: AUTH_TOKEN });
  } else {
    res.status(401).json({ message: 'Invalid credentials' });
  }
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
    res.json({ success: true, credentials: decrypted });
  } catch (err) {
    res.status(401).json({ success: false, message: 'Invalid Secret Key. Decryption failed.' });
  }
});

// Auth Middleware for protected routes
const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.split(' ')[1] === AUTH_TOKEN) {
    next();
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

// Fallback to index.html for single-page application feel
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
