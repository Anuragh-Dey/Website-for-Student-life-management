const cron = require('node-cron');
const Task = require('../models/taskModel');
const Notification = require('../models/notificationModel');

function setupCronJobs() {
  cron.schedule('0 8 * * *', async () => {
    console.log('🔔 Running daily task alert check...');
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);

    const tasksDue = await Task.find({ dueDate: { $lte: tomorrow } });

    for (const task of tasksDue) {
      await Notification.create({
        message: `Reminder: Task "${task.title}" is due by ${task.dueDate.toDateString()}`,
        type: 'task',
        createdAt: new Date()
      });
    }

    console.log(`✅ Notifications created for ${tasksDue.length} upcoming tasks.`);
  });
}

module.exports = setupCronJobs;
