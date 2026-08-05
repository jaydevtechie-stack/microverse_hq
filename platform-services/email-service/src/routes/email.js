const express = require('express');
const nodemailer = require('nodemailer');
const { renderTemplate } = require('../utils/renderTemplate');

const router = express.Router();

const transporter = nodemailer.createTransport({
  host: process.env.MAILHOG_SMTP_SERVER?.split(':')[0] || 'mailhog',
  port: process.env.MAILHOG_SMTP_SERVER?.split(':')[1] || 1025,
  secure: false,
});

// Any service (Mernable, TaskFusion, etc.) calls this with:
//   { to, subject, userName, message, brandName, template? }
// "template" defaults to "default" — pass a different folder name under
// src/templates/ once more than one template exists (e.g. "welcome", "reset-password").
router.post('/send', async (req, res) => {
  try {
    const { to, subject, userName, message, brandName, template } = req.body;

    if (!to || !subject || !userName || !message || !brandName) {
      return res.status(400).json({
        error: 'Missing required fields: to, subject, userName, message, brandName',
      });
    }

    const html = renderTemplate(template || 'default', { subject, userName, message, brandName });

    await transporter.sendMail({
      from: `"${brandName}" <no-reply@microverse.local>`,
      to,
      subject,
      html,
    });

    res.json({ status: 'sent' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send email', detail: err.message });
  }
});

module.exports = router;
