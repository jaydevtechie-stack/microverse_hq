const createTask = async (taskData) => {
  const task = await Task.create(taskData);
  
  // Logic to check urgency or deadlines
  const isUrgent = task.dueDate < Date.now();  // Task is urgent if it's past the due date

  // Create a notification based on task urgency
  await createNotification({
    id: task._id,
    userName: task.userName,
    userEmail: task.userEmail,
    isUrgent,
    name: task.name,
  });
  
  return task;
};
