require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const { clerkMiddleware } = require('@clerk/express');
const sequelize  = require('./config/database');
require('./models'); // load models and register associations

const authRouter     = require('./routes/auth');
const ridersRouter   = require('./routes/riders');
const driversRouter  = require('./routes/drivers');
const ridesRouter    = require('./routes/rides');
const paymentsRouter = require('./routes/payments');
const aiRouter       = require('./routes/ai');
const statsRouter    = require('./routes/stats');

const app  = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ───────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',').map((o) => o.trim());

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(clerkMiddleware({ publishableKey: process.env.CLERK_PUBLISHABLE_KEY }));

// ─── Routes ──────────────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({ message: 'RideFlow API is running 🚗', version: '1.0.0' });
});

app.use('/api/auth',     authRouter);
app.use('/api/riders',   ridersRouter);
app.use('/api/drivers',  driversRouter);
app.use('/api/rides',    ridesRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/ai',       aiRouter);
app.use('/api/stats',    statsRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const start = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');
    await sequelize.sync({ alter: process.env.NODE_ENV !== 'production' });
    console.log('✅ Models synced');
    app.listen(PORT, () => {
      console.log(`🚀 RideFlow server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Unable to start server:', error);
    process.exit(1);
  }
};

start();
