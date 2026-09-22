const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');

const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const profileRoutes = require('./routes/profileRoutes');
const skillRoutes = require('./routes/skillRoutes');
const credentialRoutes = require('./routes/credentialRoutes');
const verificationRoutes = require('./routes/verificationRoutes');
const identityRoutes = require('./routes/identityRoutes');
const verifyRoutes = require('./routes/verifyRoutes');
const passportRoutes = require('./routes/passportRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',') : '*',
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

// Serve uploaded credential files (temporary local storage,
// will move to IPFS/Pinata once the Decentralized Storage layer is wired in)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const DB_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

app.get('/api/health', (req, res) => {
  const state = mongoose.connection.readyState;
  res.status(200).json({
    success: true,
    message: 'Digital Skill Passport API is running',
    database: DB_STATES[state] || 'unknown',
    uptime: Math.round(process.uptime()),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/skills', skillRoutes);
app.use('/api/credentials', credentialRoutes);
app.use('/api/verifications', verificationRoutes);
app.use('/api/identity', identityRoutes);
app.use('/api/passport', passportRoutes);
app.use('/api/notifications', notificationRoutes);
// Public verification desk - no authentication by design
app.use('/api/verify', verifyRoutes);

// Reserved paths for the layers we are NOT building yet - return a clear
// "not implemented" instead of a generic 404, so the frontend/team knows
// these are coming later rather than broken.
app.use('/api/blockchain', (req, res) => {
  res.status(501).json({
    success: false,
    message: 'Blockchain/Web3 layer not yet integrated. Coming in a later phase.',
  });
});
app.use('/api/ai', (req, res) => {
  res.status(501).json({
    success: false,
    message: 'AI layer (Python service) not yet integrated. Coming in a later phase.',
  });
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;
