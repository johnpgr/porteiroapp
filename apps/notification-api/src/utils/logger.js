const fs = require('fs');
const path = require('path');

class Logger {
  constructor() {
    this.logDir = path.join(__dirname, '../../logs');
    this.ensureLogDir();
  }

  ensureLogDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...(data && { data })
    };
    return JSON.stringify(logEntry);
  }

  writeToFile(filename, message) {
    try {
      const filePath = path.join(this.logDir, filename);
      fs.appendFileSync(filePath, message + '\n');
    } catch (error) {
      console.error('Erro ao escrever no arquivo de log:', error);
    }
  }

  info(message, data = null) {
    const logMessage = this.formatMessage('INFO', message, data);
    console.log(`ℹ️ ${message}`, data || '');
    this.writeToFile('app.log', logMessage);
  }

  error(message, error = null, data = null) {
    const errorData = {
      ...data,
      ...(error && {
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name
        }
      })
    };
    
    const logMessage = this.formatMessage('ERROR', message, errorData);
    console.error(`❌ ${message}`, error || '', data || '');
    this.writeToFile('error.log', logMessage);
    this.writeToFile('app.log', logMessage);
  }

  warn(message, data = null) {
    const logMessage = this.formatMessage('WARN', message, data);
    console.warn(`⚠️ ${message}`, data || '');
    this.writeToFile('app.log', logMessage);
  }

  success(message, data = null) {
    const logMessage = this.formatMessage('SUCCESS', message, data);
    console.log(`✅ ${message}`, data || '');
    this.writeToFile('app.log', logMessage);
  }

  notification(type, recipient, status, details = null) {
    const notificationData = {
      type,
      recipient,
      status,
      ...(details && { details })
    };
    
    const message = `Notificação ${type} para ${recipient}: ${status}`;
    const logMessage = this.formatMessage('NOTIFICATION', message, notificationData);
    
    if (status === 'success') {
      console.log(`📧 ${message}`);
    } else {
      console.error(`📧❌ ${message}`);
    }
    
    this.writeToFile('notifications.log', logMessage);
    this.writeToFile('app.log', logMessage);
  }

  reminder(action, lembreteId, details = null) {
    const reminderData = {
      action,
      lembreteId,
      ...(details && { details })
    }
    
    const message = `Lembrete ${lembreteId}: ${action}`;
    const logMessage = this.formatMessage('REMINDER', message, reminderData);
    
    console.log(`🔔 ${message}`);
    this.writeToFile('reminders.log', logMessage);
    this.writeToFile('app.log', logMessage);
  }

  // Limpar logs antigos (manter apenas os últimos 7 dias)
  cleanOldLogs() {
    try {
      const files = fs.readdirSync(this.logDir);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      files.forEach(file => {
        const filePath = path.join(this.logDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime < sevenDaysAgo) {
          fs.unlinkSync(filePath);
          console.log(`🗑️ Log antigo removido: ${file}`);
        }
      });
    } catch (error) {
      console.error('Erro ao limpar logs antigos:', error);
    }
  }
}

// Instância singleton
const logger = new Logger();

module.exports = logger;