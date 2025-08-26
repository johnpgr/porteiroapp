const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

const sendNotificationRouter = require('./routes/sendNotification');
const completeRegistrationRouter = require('./routes/completeRegistration');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: false 
}));

app.use(express.json());

// Rotas
app.use('/api', sendNotificationRouter);
app.use('/api', completeRegistrationRouter);

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
