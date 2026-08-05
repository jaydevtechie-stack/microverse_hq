const Notification = require('../models/notification');
const sendEmail = require('./emailService');

// Method to create a notification and send an email
const createNotification = async (task) => {
  const notification = new Notification({
    subject: `Task #${task.id} Due Soon`,
    userName: task.userName,
    message: `Your task "${task.name}" is approaching its deadline.`,
    theme: task.isUrgent ? 'urgent' : 'reminder',
  });

  await notification.save();
  
  // Send the email notification
  await sendEmail(notification._id, task.userEmail);
};

module.exports = { createNotification };
