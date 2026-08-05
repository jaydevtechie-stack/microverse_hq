const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.get('/', (req, res) => {
  res.send('Notification Service is Running');
});

// Notify frontend via WebSockets
const sendNotification = (message) => {
  io.emit('notification', { message });
};

// Example: send a notification every 5 seconds
setInterval(() => {
  sendNotification('You have a new notification!');
}, 5000);

// Listen for WebSocket connections
io.on('connection', (socket) => {
  console.log('A user connected');
  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

server.listen(4001, () => {
  console.log('Notification service listening on port 4001');
});
