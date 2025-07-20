const express = require('express'); 
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.send('API is working');
});

const taskRoutes = require('./routes/taskRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const authRoutes = require('./routes/authRoutes');
const homeRoutes = require('./routes/homeRoutes');

app.use('/tasks', taskRoutes);
app.use('/expenses', expenseRoutes);
app.use('/notifications', notificationRoutes);
app.use( authRoutes);
app.use(homeRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/tasksdb', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));
app.post('/test', (req, res) => {
  console.log(req.body);
  res.json({ received: req.body });
});
