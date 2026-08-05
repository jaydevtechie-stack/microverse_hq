// task-service/index.js
const amqp = require('amqplib');

const assignDefaultTasks = (user) => {
  // Logic to assign default tasks to the user
  console.log(`Assigning default tasks to user ${user.name}`);
};

// Consume the user.created event and assign tasks
const consumeUserCreatedEvent = async () => {
  const connection = await amqp.connect('amqp://localhost');
  const channel = await connection.createChannel();

  await channel.assertExchange('user_exchange', 'fanout', { durable: true });
  const q = await channel.assertQueue('', { exclusive: true });
  channel.bindQueue(q.queue, 'user_exchange', '');
  
  channel.consume(q.queue, (msg) => {
    const user = JSON.parse(msg.content.toString());
    assignDefaultTasks(user);
    console.log('Default tasks assigned to user:', user.name);
  }, { noAck: true });
};

consumeUserCreatedEvent();
