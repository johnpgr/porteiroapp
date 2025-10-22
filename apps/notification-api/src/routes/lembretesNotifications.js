const express = require('express');
const router = express.Router();
const emailService = require('../services/emailService');
const whatsappService = require('../services/whatsappService');
const reminderJobService = require('../services/reminderJobService');

// Endpoint para processar notificações quando um lembrete é criado
router.post('/lembretes-notifications', async (req, res) => {
  try {
    const { lembrete, sindico } = req.body;

    if (!lembrete || !sindico) {
      return res.status(400).json({ 
        error: 'Dados do lembrete e síndico são obrigatórios' 
      });
    }

    const notifications = [];

    // Preparar dados da notificação
    const notificationData = {
      titulo: lembrete.titulo,
      descricao: lembrete.descricao,
      dataVencimento: lembrete.data_vencimento,
      prioridade: lembrete.prioridade,
      categoria: lembrete.categoria,
      antecedenciaAlerta: lembrete.antecedencia_alerta
    };

    // Enviar notificação por email
    if (sindico.email) {
      try {
        const emailResult = await emailService.sendEmail({
          to: sindico.email,
          subject: `Novo Lembrete: ${lembrete.titulo}`,
          html: `
            <h2>Novo Lembrete Criado</h2>
            <p><strong>Título:</strong> ${lembrete.titulo}</p>
            <p><strong>Descrição:</strong> ${lembrete.descricao}</p>
            <p><strong>Data de Vencimento:</strong> ${new Date(lembrete.data_vencimento).toLocaleString('pt-BR')}</p>
            <p><strong>Prioridade:</strong> ${lembrete.prioridade}</p>
            <p><strong>Categoria:</strong> ${lembrete.categoria}</p>
            <p><strong>Alerta com antecedência de:</strong> ${lembrete.antecedencia_alerta} minutos</p>
          `
        });
        notifications.push({ type: 'email', status: 'success', result: emailResult });
      } catch (emailError) {
        console.error('Erro ao enviar email:', emailError);
        notifications.push({ type: 'email', status: 'error', error: emailError.message });
      }
    }

    // Enviar notificação por WhatsApp
    if (sindico.telefone) {
      try {
        const whatsappMessage = `🔔 *Novo Lembrete Criado*\n\n` +
          `📋 *Título:* ${lembrete.titulo}\n` +
          `📝 *Descrição:* ${lembrete.descricao}\n` +
          `📅 *Vencimento:* ${new Date(lembrete.data_vencimento).toLocaleString('pt-BR')}\n` +
          `⚡ *Prioridade:* ${lembrete.prioridade}\n` +
          `🏷️ *Categoria:* ${lembrete.categoria}\n` +
          `⏰ *Alerta:* ${lembrete.antecedencia_alerta} minutos antes`;

        const whatsappResult = await whatsappService.sendWhatsApp(sindico.telefone, whatsappMessage);
        notifications.push({ type: 'whatsapp', status: 'success', result: whatsappResult });
      } catch (whatsappError) {
        console.error('Erro ao enviar WhatsApp:', whatsappError);
        notifications.push({ type: 'whatsapp', status: 'error', error: whatsappError.message });
      }
    }

    res.json({
      success: true,
      message: 'Notificações processadas',
      notifications
    });

  } catch (error) {
    console.error('Erro ao processar notificações:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
});

// Endpoint para obter status do job de lembretes
router.get('/lembretes-job/status', (req, res) => {
  try {
    const status = reminderJobService.getStatus();
    res.json({
      success: true,
      status
    });
  } catch (error) {
    console.error('Erro ao obter status do job:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
});

// Endpoint para iniciar o job de lembretes
router.post('/lembretes-job/start', (req, res) => {
  try {
    reminderJobService.start();
    res.json({
      success: true,
      message: 'Job de lembretes iniciado'
    });
  } catch (error) {
    console.error('Erro ao iniciar job:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
});

// Endpoint para parar o job de lembretes
router.post('/lembretes-job/stop', (req, res) => {
  try {
    reminderJobService.stop();
    res.json({
      success: true,
      message: 'Job de lembretes parado'
    });
  } catch (error) {
    console.error('Erro ao parar job:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
});

// Endpoint para forçar verificação manual de lembretes
router.post('/lembretes-job/check', async (req, res) => {
  try {
    await reminderJobService.checkReminders();
    res.json({
      success: true,
      message: 'Verificação manual de lembretes executada'
    });
  } catch (error) {
    console.error('Erro na verificação manual:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
});

module.exports = router;
