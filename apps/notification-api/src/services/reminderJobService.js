const { createClient } = require('@supabase/supabase-js');
const emailService = require('./emailService');
const whatsappService = require('./whatsappService');
const logger = require('../utils/logger');

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

class ReminderJobService {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.checkInterval = 5 * 60 * 1000; // 5 minutos
  }

  // Iniciar o job de verificação
  start() {
    if (this.isRunning) {
      logger.warn('Job de lembretes já está em execução');
      return;
    }

    logger.info('Iniciando job de verificação de lembretes');
    this.isRunning = true;
    
    // Executar imediatamente e depois a cada intervalo
    this.checkReminders();
    this.intervalId = setInterval(() => {
      this.checkReminders();
    }, this.checkInterval);
  }

  // Parar o job
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info('Job de lembretes parado');
  }

  // Verificar lembretes próximos ao vencimento
  async checkReminders() {
    try {
      logger.info('Verificando lembretes próximos ao vencimento');
      
      const now = new Date();
      
      // Buscar lembretes ativos que ainda não venceram
      const { data: lembretes, error } = await supabase
        .from('lembretes')
        .select(`
          *,
          admin_profiles!lembretes_sindico_id_fkey (
            id,
            nome,
            email,
            telefone
          )
        `)
        .eq('status', 'ativo')
        .gt('data_vencimento', now.toISOString());

      if (error) {
        logger.error('Erro ao buscar lembretes', error);
        return;
      }

      if (!lembretes || lembretes.length === 0) {
        logger.info('Nenhum lembrete ativo encontrado');
        return;
      }

      logger.info(`Encontrados ${lembretes.length} lembretes ativos`);

      // Verificar cada lembrete
      for (const lembrete of lembretes) {
        await this.processReminder(lembrete);
      }

    } catch (error) {
      logger.error('Erro no job de lembretes', error);
    }
  }

  // Processar um lembrete individual
  async processReminder(lembrete) {
    try {
      const now = new Date();
      const dataVencimento = new Date(lembrete.data_vencimento);
      const antecedenciaMs = lembrete.antecedencia_alerta * 60 * 1000; // converter minutos para ms
      const tempoAlerta = new Date(dataVencimento.getTime() - antecedenciaMs);

      // Verificar se é hora de enviar o alerta
      if (now >= tempoAlerta && now < dataVencimento) {
        // Verificar se já foi enviado alerta para este lembrete
        const { data: historico } = await supabase
          .from('lembrete_historico')
          .select('id')
          .eq('lembrete_id', lembrete.id)
          .eq('acao', 'alerta_enviado')
          .single();

        if (historico) {
          // Alerta já foi enviado
          return;
        }

        logger.reminder('enviando_alerta', lembrete.id, { titulo: lembrete.titulo });
        await this.sendReminderAlert(lembrete);
        
        // Registrar no histórico que o alerta foi enviado
        await supabase
          .from('lembrete_historico')
          .insert({
            lembrete_id: lembrete.id,
            acao: 'alerta_enviado',
            detalhes: `Alerta enviado ${lembrete.antecedencia_alerta} minutos antes do vencimento`
          });
      }

      // Verificar se o lembrete venceu
      if (now >= dataVencimento && lembrete.status === 'ativo') {
        logger.reminder('vencido', lembrete.id, { titulo: lembrete.titulo });
        
        // Atualizar status para vencido
        await supabase
          .from('lembretes')
          .update({ status: 'vencido' })
          .eq('id', lembrete.id);

        // Registrar no histórico
        await supabase
          .from('lembrete_historico')
          .insert({
            lembrete_id: lembrete.id,
            acao: 'vencido',
            detalhes: 'Lembrete marcado como vencido automaticamente'
          });
      }

    } catch (error) {
      logger.error(`Erro ao processar lembrete ${lembrete.id}`, error, { lembreteId: lembrete.id });
    }
  }

  // Enviar alerta de lembrete
  async sendReminderAlert(lembrete) {
    const sindico = lembrete.admin_profiles;
    
    if (!sindico) {
      logger.error('Síndico não encontrado para o lembrete', null, { lembreteId: lembrete.id });
      return;
    }

    const notifications = [];

    // Enviar por email
    if (sindico.email) {
      try {
        await emailService.sendEmail({
          to: sindico.email,
          subject: `🔔 Lembrete: ${lembrete.titulo}`,
          html: `
            <h2>⏰ Lembrete Próximo ao Vencimento</h2>
            <p><strong>Título:</strong> ${lembrete.titulo}</p>
            <p><strong>Descrição:</strong> ${lembrete.descricao}</p>
            <p><strong>Vencimento:</strong> ${new Date(lembrete.data_vencimento).toLocaleString('pt-BR')}</p>
            <p><strong>Prioridade:</strong> ${lembrete.prioridade}</p>
            <p><strong>Categoria:</strong> ${lembrete.categoria}</p>
            <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; margin: 10px 0; border-radius: 5px;">
              <strong>⚠️ Este lembrete vence em breve!</strong>
            </div>
          `
        });
        notifications.push({ type: 'email', status: 'success' });
        logger.notification('email', sindico.email, 'success', { lembreteId: lembrete.id });
      } catch (error) {
        logger.notification('email', sindico.email, 'error', { lembreteId: lembrete.id, error: error.message });
        notifications.push({ type: 'email', status: 'error', error: error.message });
      }
    }

    // Enviar por WhatsApp
    if (sindico.telefone) {
      try {
        const message = `🔔 *Lembrete Próximo ao Vencimento*\n\n` +
          `📋 *Título:* ${lembrete.titulo}\n` +
          `📝 *Descrição:* ${lembrete.descricao}\n` +
          `📅 *Vencimento:* ${new Date(lembrete.data_vencimento).toLocaleString('pt-BR')}\n` +
          `⚡ *Prioridade:* ${lembrete.prioridade}\n` +
          `🏷️ *Categoria:* ${lembrete.categoria}\n\n` +
          `⚠️ *Este lembrete vence em breve!*`;

        await whatsappService.sendWhatsApp(sindico.telefone, message);
        notifications.push({ type: 'whatsapp', status: 'success' });
        logger.notification('whatsapp', sindico.telefone, 'success', { lembreteId: lembrete.id });
      } catch (error) {
        logger.notification('whatsapp', sindico.telefone, 'error', { lembreteId: lembrete.id, error: error.message });
        notifications.push({ type: 'whatsapp', status: 'error', error: error.message });
      }
    }

    return notifications;
  }

  // Obter status do job
  getStatus() {
    return {
      isRunning: this.isRunning,
      checkInterval: this.checkInterval,
      nextCheck: this.intervalId ? new Date(Date.now() + this.checkInterval) : null
    };
  }
}

// Instância singleton
const reminderJobService = new ReminderJobService();

module.exports = reminderJobService;