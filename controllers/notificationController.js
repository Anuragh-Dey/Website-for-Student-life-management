const Notification = require('../models/notificationModel');

exports.getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find().sort({ createdAt: -1 });
    res.json(notifications);  
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};


exports.markAsRead = async (req, res) => {
  try {
    const updated = await Notification.findByIdAndUpdate(req.params.id, { read: true });
    if (!updated) {
      return res.status(404).send('Notification not found');
    }
    res.redirect('/notifications');
  } catch (err) {
    console.error('Error marking notification as read:', err);
    res.status(500).send('Server error');
  }
};
