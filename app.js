require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');

const app = express();

// Config
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/tasksdb';

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

// Health + root
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get('/', (req, res) => res.send('API is working'));

// Routes 
const taskRoutes = require('./routes/taskRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const authRoutes = require('./routes/authRoutes');
const homeRoutes = require('./routes/homeRoutes');
const academicRoutes = require('./routes/academicRoutes');
const documentRoutes = require('./routes/documentRoutes');
const emergencyRoutes = require('./routes/emergencyRoutes');
const splitRoutes = require('./routes/splitRoutes');
const mealRoutes = require('./routes/mealRoutes');

const auth = require('./middleware/auth');

app.use('/tasks', taskRoutes);
app.use('/expenses', expenseRoutes);
app.use('/notifications', notificationRoutes);
app.use('/academics', academicRoutes);
app.use('/documents', documentRoutes);
app.use('/auth', authRoutes);
app.use('/', homeRoutes);
app.use('/emergency-fund', emergencyRoutes);
app.use('/split', splitRoutes);
app.use('/meals', mealRoutes);

app.post('/test', (req, res) => {
  console.log(req.body);
  res.json({ received: req.body });
});

// 404 + error handlers
app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Internal Server Error' });
});

// Start server AFTER DB is connected
(async () => {
  try {
    await mongoose.connect(MONGO_URI); 
    console.log('MongoDB connected');

    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    // Graceful shutdown
    const shutdown = () => {
      console.log('Shutting down...');
      server.close(() => {
        mongoose.connection.close(false, () => {
          console.log('MongoDB connection closed');
          process.exit(0);
        });
      });
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
})();

module.exports = app;
