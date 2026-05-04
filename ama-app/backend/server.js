require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

// Initialize Express App
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());
app.use(morgan('dev'));

// Rate Limiting: 100 requests per 15 minutes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { message: 'Too many requests from this IP, please try again after 15 minutes' }
});
app.use('/api', limiter);

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Import Routes
const authRoutes = require('./routes/auth');
const claudeRoutes = require('./routes/claude');
const emailsRoutes = require('./routes/emails');
const tasksRoutes = require('./routes/tasks');
const teamRoutes = require('./routes/team');
const analyticsRoutes = require('./routes/analytics');
const gmailRoutes = require('./routes/gmail');

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/ama', claudeRoutes);
app.use('/api/emails', emailsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/gmail', gmailRoutes);

// Global Error Handler
const { errorHandler } = require('./middleware/errorHandler');
app.use(errorHandler);

// Start Server
app.listen(PORT, () => {
  console.log(`\n🚀 Ama Backend running at http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
});
