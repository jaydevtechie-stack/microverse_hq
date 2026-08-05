// src/components/Notification.js
import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

const Notification = () => {
  const [notifications, setNotifications] = useState([]);
  const socket = io('http://localhost:4001');  // Backend service for notifications

  useEffect(() => {
    socket.on('notification', (data) => {
      setNotifications((prevNotifications) => [...prevNotifications, data.message]);
    });

    return () => {
      socket.off('notification');
    };
  }, [socket]);

  return (
    <div className="notifications">
      {notifications.map((notif, index) => (
        <div key={index} className="notification-popup">
          {notif}
        </div>
      ))}
    </div>
  );
};

export default Notification;
