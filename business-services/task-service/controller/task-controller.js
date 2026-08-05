const taskService = require('../../notification-service/services/taskService');
const notificationService = require('../../notification-service/services/notificationService');

exports.createTask = async (req, res) => {
  try {
    const task = await taskService.createTask(req.body);

    // After task creation, create a notification
    await notificationService.createNotification(task);
    
    return res.status(201).json({
      message: 'Task created and notification sent!',
      task,
    });
  } catch (error) {
    console.error('Error creating task:', error);
    return res.status(500).json({
      message: 'Error creating task',
      error,
    });
  }
};
