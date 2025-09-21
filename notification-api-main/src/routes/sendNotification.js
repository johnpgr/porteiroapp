const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const { validateResidentNotification, validateRegularizationNotification, validateVisitorAuthorization } = require('../validators/notificationValidator');
const { sendWhatsApp } = require('../services/whatsappService');
const { generateRegistrationLink, generateWhatsAppMessage, generateRegularizationLink, generateRegularizationMessage, generateVisitorAuthorizationLink, generateVisitorAuthorizationMessage } = require('../utils/messageFormatter');

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || 'https://ycamhxzumzkpxuhtugxc.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYW1oeHp1bXprcHh1aHR1Z3hjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTcyMTAzMSwiZXhwIjoyMDcxMjk3MDMxfQ.5abRJDfQeKopRnaoYmFgoS7-0SoldraEMp_VPM7OjdQ';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// POST /api/send-resident-whatsapp - Endpoint específico para envio de mensagens WhatsApp para moradores
router.post('/send-resident-whatsapp', async (req, res) => {
  try {
    console.log('Enviando notificação WhatsApp para morador:', req.body);

    const { name, email, phone, building, apartment, building_id, profile_id } = req.body;

    if (!name || !email || !building || !apartment || !profile_id) {
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios: name, email, building, apartment, profile_id'
      });
    }

    // Buscar senha temporária no Supabase
    let temporary_password = 'Senha será enviada em breve';
    try {
      const { data: passwordData, error: passwordError } = await supabase
        .from('temporary_passwords')
        .select('plain_password')
        .eq('profile_id', profile_id)
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (passwordError) {
        console.log('Nenhuma senha temporária encontrada para profile_id:', profile_id);
      } else if (passwordData) {
        temporary_password = passwordData.plain_password;
        console.log('Senha temporária encontrada para profile_id:', profile_id);
      }
    } catch (supabaseError) {
      console.error('Erro ao buscar senha temporária:', supabaseError.message);
      // Continua com a mensagem padrão
    }
    
    console.log('Dados para WhatsApp:', { name, email, phone, building, apartment, temporary_password });

    // Send WhatsApp notification with credentials (no user creation)
    const siteUrl = process.env.SITE_URL || 'porteiroapp://login';
  const completarCadastroUrl = 'porteiroapp://login';
    const whatsappMessage = `🏢 JamesAvisa - Cadastro de Morador

Olá *${name}*!

Você foi convidado(a) para se cadastrar no JamesAvisa.

📍 Dados do seu apartamento:

🏢 Prédio: ${building}

🚪 Apartamento: ${apartment}

🔐 SUAS CREDENCIAIS DE ACESSO:

📧 Usuário (Email): ${email}

🔑 Senha temporária: ${temporary_password || 'Será enviada em breve'}

💡 IMPORTANTE: Use seu email como usuário para fazer login!

Com o JamesAvisa você pode:

✅ Receber visitantes com mais segurança

✅ Autorizar entregas remotamente

✅ Comunicar-se diretamente com a portaria

✅ Acompanhar movimentações do seu apartamento

Mensagem enviada automaticamente pelo sistema JamesAvisa`

    try {
      // Se houver telefone, envia por WhatsApp, senão apenas registra o sucesso
      if (phone) {
        await sendWhatsApp({
          to: phone,
          message: whatsappMessage
        });
        console.log('WhatsApp enviado com sucesso para:', phone);
      } else {
        console.log('Cadastro realizado sem envio de WhatsApp (telefone não fornecido)');
      }
    } catch (whatsappError) {
      console.error('Erro ao enviar WhatsApp:', whatsappError.message);
      // Don't fail the registration if WhatsApp fails
    }

    res.json({
      success: true,
      message: 'Cadastro iniciado com sucesso! Verifique seu WhatsApp para as credenciais de acesso.',
      data: {
          profile_id: profile_id,
          building_name: building,
          apartment_number: apartment
        }
    });

  } catch (error) {
    console.error('Erro no cadastro de morador:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// POST /api/send-porteiro-whatsapp - Endpoint específico para envio de mensagens WhatsApp para porteiros
router.post('/send-porteiro-whatsapp', async (req, res) => {
  try {
    console.log('Enviando notificação WhatsApp para porteiro:', req.body);

    const { name, email, phone, building, cpf, work_schedule, profile_id } = req.body;

    if (!name || !email || !building || !profile_id) {
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios: name, email, building, profile_id'
      });
    }

    // Buscar senha temporária no Supabase
    let temporary_password = 'Senha será enviada em breve';
    try {
      const { data: passwordData, error: passwordError } = await supabase
        .from('temporary_passwords')
        .select('plain_password')
        .eq('profile_id', profile_id)
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (passwordError) {
        console.log('Nenhuma senha temporária encontrada para profile_id:', profile_id);
      } else if (passwordData) {
        temporary_password = passwordData.plain_password;
        console.log('Senha temporária encontrada para profile_id:', profile_id);
      }
    } catch (supabaseError) {
      console.error('Erro ao buscar senha temporária:', supabaseError.message);
      // Continua com a mensagem padrão
    }
    
    console.log('Dados para WhatsApp:', { name, email, phone, building, cpf, work_schedule, temporary_password });

    // Formatação do horário de trabalho
    const workScheduleText = work_schedule ? 
      `\n🕐 Horário de trabalho: ${work_schedule}` : '';

    // Send WhatsApp notification with credentials for porteiro
    const whatsappMessage = `🏢 JamesAvisa - Cadastro de Porteiro

Olá *${name}*!

Você foi cadastrado(a) como porteiro no JamesAvisa.

📍 Dados do seu trabalho:

🏢 Prédio: ${building}${workScheduleText}

🔐 SUAS CREDENCIAIS DE ACESSO:

📧 Usuário (Email): ${email}

🔑 Senha temporária: ${temporary_password || 'Será enviada em breve'}

💡 IMPORTANTE: Use seu email como usuário para fazer login!

Como porteiro no JamesAvisa você pode:

✅ Gerenciar visitantes e entregas

✅ Autorizar acessos remotamente

✅ Comunicar-se com os moradores

✅ Registrar ocorrências

✅ Controlar entrada e saída de veículos

Mensagem enviada automaticamente pelo sistema JamesAvisa`;

    try {
      // Se houver telefone, envia por WhatsApp, senão apenas registra o sucesso
      if (phone) {
        await sendWhatsApp({
          to: phone,
          message: whatsappMessage
        });
        console.log('WhatsApp enviado com sucesso para porteiro:', phone);
      } else {
        console.log('Cadastro de porteiro realizado sem envio de WhatsApp (telefone não fornecido)');
      }
    } catch (whatsappError) {
      console.error('Erro ao enviar WhatsApp para porteiro:', whatsappError.message);
      // Don't fail the registration if WhatsApp fails
    }

    res.json({
      success: true,
      message: 'Cadastro de porteiro iniciado com sucesso! Verifique seu WhatsApp para as credenciais de acesso.',
      data: {
        profile_id: profile_id,
        building_name: building,
        work_schedule: work_schedule
      }
    });

  } catch (error) {
    console.error('Erro no cadastro de porteiro:', error);

    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// GET /api/whatsapp-status - Verificar status da instância WhatsApp
router.get('/whatsapp-status', async (req, res) => {
  try {
    const status = await checkInstanceStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({
      connected: false,
      error: 'Erro ao verificar status da instância'
    });
  }
});

// GET /api/whatsapp-qr - Gerar QR Code para conectar WhatsApp
router.get('/whatsapp-qr', async (req, res) => {
  try {
    const qrData = await generateQRCode();
    res.json(qrData);
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

// POST /api/send-regularization-whatsapp - Endpoint para envio de mensagens de regularização para moradores
router.post('/send-regularization-whatsapp', async (req, res) => {
  const startTime = Date.now();
  console.log('🚀 Iniciando envio de mensagem de regularização WhatsApp para morador:', req.body);
  
  try {
    // Validar dados usando o validator
    const validation = validateRegularizationNotification(req.body);
    if (!validation.success) {
      console.error('❌ Dados inválidos:', validation.errors);
      return res.status(400).json({ 
        success: false, 
        whatsappSent: false, 
        error: 'Dados inválidos',
        details: validation.errors,
        timestamp: new Date().toISOString()
      });
    }

    const regularizationData = validation.parsed;
    if (regularizationData.phone) {
      regularizationData.phone = regularizationData.phone.replace(/\D/g, ''); // Remove caracteres não numéricos
    }

    console.log('✅ Dados de regularização validados:', {
      name: regularizationData.name,
      email: regularizationData.email,
      phone: regularizationData.phone,
      building: regularizationData.building,
      apartment: regularizationData.apartment,
      issueType: regularizationData.issueType
    });

    // Gerar link de regularização personalizado
    const regularizationLink = generateRegularizationLink(regularizationData, regularizationData.regularizationUrl);
    console.log('🔗 Link de regularização gerado:', regularizationLink);

    // Gerar mensagem formatada
    const whatsappMessage = generateRegularizationMessage(regularizationData, regularizationLink);
    console.log('📝 Mensagem de regularização formatada:', whatsappMessage.substring(0, 100) + '...');

    // Enviar mensagem via WhatsApp (se telefone estiver disponível)
    let whatsappResult = null;
    if (regularizationData.phone) {
      whatsappResult = await sendWhatsApp({
        to: regularizationData.phone,
        message: whatsappMessage
      });
      console.log(`✅ Mensagem de regularização WhatsApp enviada com sucesso para:`, regularizationData.phone);
    } else {
      console.log('✅ Regularização processada sem envio de WhatsApp (telefone não fornecido)');
    }

    const duration = Date.now() - startTime;

    res.json({
      success: true,
      whatsappSent: true,
      messageId: whatsappResult.messageId,
      regularizationLink,
      recipient: {
        name: regularizationData.name,
        email: regularizationData.email,
        phone: regularizationData.phone,
        building: regularizationData.building,
        apartment: regularizationData.apartment,
        issueType: regularizationData.issueType
      },
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ Erro ao enviar mensagem de regularização WhatsApp:', error.message);
    console.error('Stack trace:', error.stack);

    res.status(500).json({
      success: false,
      whatsappSent: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });
  }
});

// POST /api/send-visitor-authorization-whatsapp - Endpoint para envio de mensagens de autorização de visitante
router.post('/send-visitor-authorization-whatsapp', async (req, res) => {
  const startTime = Date.now();
  console.log('🚀 Iniciando envio de mensagem de autorização de visitante WhatsApp:', req.body);
  
  try {
    // Validar dados usando o validator
    const validation = validateVisitorAuthorization(req.body);
    if (!validation.success) {
      console.error('❌ Dados inválidos:', validation.errors);
      return res.status(400).json({ 
        success: false, 
        whatsappSent: false, 
        error: 'Dados inválidos',
        details: validation.errors,
        timestamp: new Date().toISOString()
      });
    }

    const authorizationData = validation.parsed;
    if (authorizationData.residentPhone) {
      authorizationData.residentPhone = authorizationData.residentPhone.replace(/\D/g, ''); // Remove caracteres não numéricos
    }

    console.log('✅ Dados de autorização de visitante validados:', {
      visitorName: authorizationData.visitorName,
      residentName: authorizationData.residentName,
      residentEmail: authorizationData.residentEmail,
      residentPhone: authorizationData.residentPhone,
      building: authorizationData.building,
      apartment: authorizationData.apartment
    });

    // Gerar link de autorização personalizado
    const authorizationLink = generateVisitorAuthorizationLink(authorizationData);
    console.log('🔗 Link de autorização gerado:', authorizationLink);

    // Gerar mensagem formatada
    const whatsappMessage = generateVisitorAuthorizationMessage(authorizationData, authorizationLink);
    console.log('📝 Mensagem de autorização formatada:', whatsappMessage);

    // Enviar mensagem via WhatsApp (se telefone estiver disponível)
    let whatsappResult = null;
    if (authorizationData.residentPhone) {
      whatsappResult = await sendWhatsApp({
        to: authorizationData.residentPhone,
        message: whatsappMessage
      });
      console.log(`✅ Mensagem de autorização WhatsApp enviada com sucesso para:`, authorizationData.residentPhone);
    } else {
      console.log('✅ Autorização processada sem envio de WhatsApp (telefone não fornecido)');
    }

    const duration = Date.now() - startTime;

    res.json({
      success: true,
      whatsappSent: true,
      messageId: whatsappResult.messageId,
      authorizationLink,
      recipient: {
        visitorName: authorizationData.visitorName,
        residentName: authorizationData.residentName,
        residentEmail: authorizationData.residentEmail,
        residentPhone: authorizationData.residentPhone,
        building: authorizationData.building,
        apartment: authorizationData.apartment
      },
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ Erro ao enviar mensagem de autorização WhatsApp:', error.message);
    console.error('Stack trace:', error.stack);

    res.status(500).json({
      success: false,
      whatsappSent: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });
  }
});

module.exports = router;