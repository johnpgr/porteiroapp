const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const http = require('http');

dotenv.config();

const sendNotificationRouter = require('./routes/sendNotification');
const completeRegistrationRouter = require('./routes/completeRegistration');
const visitorAuthorizationRouter = require('./routes/visitorAuthorization');
const residentRegistrationRouter = require('./routes/residentRegistration');
const sendVisitorNotificationRouter = require('./routes/sendVisitorNotification');
const sendVisitorWaitingNotificationRouter = require('./routes/sendVisitorWaitingNotification');
const whatsappWebhookRouter = require('./routes/whatsappWebhook');
const lembretesNotificationsRouter = require('./routes/lembretesNotifications');
const intercomRouter = require('./routes/intercom');
const reminderJobService = require('./services/reminderJobService');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

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
app.use('/api', visitorAuthorizationRouter);
app.use('/api', residentRegistrationRouter);
app.use('/api', sendVisitorNotificationRouter);
app.use('/api', sendVisitorWaitingNotificationRouter);
app.use('/api', whatsappWebhookRouter);
app.use('/api', lembretesNotificationsRouter);
app.use('/api', intercomRouter);

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok' }));

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  
  // Iniciar o job de lembretes
  reminderJobService.start();
});
