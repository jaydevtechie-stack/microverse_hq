require('dotenv').config();
const express = require('express');
const emailRouter = require('./routes/email');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/email', emailRouter);

app.listen(PORT, () => console.log(`email-service: listening on port ${PORT}`));
