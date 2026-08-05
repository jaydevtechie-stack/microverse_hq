const notificationService = require('../services/notificationService');

exports.createNotification = async (req, res) => {
  try {
    const { task } = req.body;  // Assume task is passed in the request body
    await notificationService.createNotification(task);
    return res.status(201).json({
      message: 'Notification created and email sent successfully!',
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    return res.status(500).json({
      message: 'Error creating notification',
      error,
    });
  }
};
