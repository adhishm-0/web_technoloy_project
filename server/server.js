require('dotenv').config();
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || /replace_with|example_secret|generate_a_unique/i.test(process.env.JWT_SECRET)) {
  console.error('JWT_SECRET must be a unique random value with at least 32 characters.');
  process.exit(1);
}
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errors');
const app = express();
app.set('trust proxy', 1);
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174').split(',').map(origin => origin.trim());
app.use(helmet());
const crossOriginCors = cors({ origin(origin, callback) { if (!origin || allowedOrigins.includes(origin)) return callback(null, true); return callback(new Error('Origin is not allowed by CORS')); } });
app.use((req, res, next) => {
  const origin = req.get('origin');
  const requestOrigin = `${req.protocol}://${req.get('host')}`;
  if (!origin || origin === requestOrigin) return next();
  return crossOriginCors(req, res, next);
});
app.use(express.json({ limit: '4mb' }));
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    next(error);
  }
});
app.get('/api/health', (req, res) => res.json({ success: true, message: 'Digital Notice Board API is running' }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/notices', require('./routes/notices'));
app.use('/api/users', require('./routes/users'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/events', require('./routes/events'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/audit', require('./routes/audit'));
app.use(notFound);
app.use(errorHandler);
const port = process.env.PORT || 5000;

if (require.main === module) {
  app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
}

module.exports = app;
