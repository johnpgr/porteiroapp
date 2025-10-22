const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { 
  sendWhatsAppWithButtons, 
  sendWhatsAppWithList,
  generateVisitorAuthorizationMessageWithButtons,
  generateVisitorAuthorizationMessageWithList
} = require('../services/whatsappService');

// Environment variables accessed via process.env
const router = express.Router();

// Configuração do Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Enviar notificação com botões interativos
router.post('/send-interactive-notification', async (req, res) => {
  try {
    const { 
      phoneNumber, 
      visitorName, 
      apartmentNumber, 
      visitType = 'visitor',
      tokenId,
      useList = false // Se true, usa lista interativa; se false, usa botões
    } = req.body;
    
    // Validar dados obrigatórios
    if (!phoneNumber || !visitorName || !apartmentNumber || !tokenId) {
      return res.status(400).json({
        error: 'Dados obrigatórios: phoneNumber, visitorName, apartmentNumber, tokenId'
      });
    }
    
    console.log(`📤 Enviando notificação interativa para ${phoneNumber}`);
    console.log('Dados:', { visitorName, apartmentNumber, visitType, tokenId, useList });
    
    let result;
    
    if (useList) {
      // Usar lista interativa
      const { message, listItems, title } = generateVisitorAuthorizationMessageWithList(
        visitorName, 
        apartmentNumber, 
        visitType
      );
      
      result = await sendWhatsAppWithList(
        phoneNumber, 
        message, 
        listItems, 
        tokenId, 
        title
      );
    } else {
      // Usar botões interativos
      const { message, buttons } = generateVisitorAuthorizationMessageWithButtons(
        visitorName, 
        apartmentNumber, 
        visitType
      );
      
      result = await sendWhatsAppWithButtons(
        phoneNumber, 
        message, 
        buttons, 
        tokenId
      );
    }
    
    console.log('✅ Notificação interativa enviada com sucesso');
    
    res.status(200).json({
      success: true,
      message: 'Notificação interativa enviada com sucesso',
      data: result
    });
    
  } catch (error) {
    console.error('❌ Erro ao enviar notificação interativa:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
});

// Enviar notificação personalizada com botões customizados
router.post('/send-custom-buttons', async (req, res) => {
  try {
    const { 
      phoneNumber, 
      message, 
      buttons, 
      tokenId
    } = req.body;
    
    // Validar dados obrigatórios
    if (!phoneNumber || !message || !buttons || !Array.isArray(buttons) || !tokenId) {
      return res.status(400).json({
        error: 'Dados obrigatórios: phoneNumber, message, buttons (array), tokenId'
      });
    }
    
    // Validar formato dos botões
    const isValidButtons = buttons.every(button => 
      button.id && button.title && 
      typeof button.id === 'string' && 
      typeof button.title === 'string'
    );
    
    if (!isValidButtons) {
      return res.status(400).json({
        error: 'Formato inválido dos botões. Cada botão deve ter id e title (strings)'
      });
    }
    
    console.log(`📤 Enviando mensagem com botões customizados para ${phoneNumber}`);
    
    const result = await sendWhatsAppWithButtons(
      phoneNumber, 
      message, 
      buttons, 
      tokenId
    );
    
    console.log('✅ Mensagem com botões customizados enviada com sucesso');
    
    res.status(200).json({
      success: true,
      message: 'Mensagem com botões enviada com sucesso',
      data: result
    });
    
  } catch (error) {
    console.error('❌ Erro ao enviar mensagem com botões customizados:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
});

// Enviar notificação personalizada com lista customizada
router.post('/send-custom-list', async (req, res) => {
  try {
    const { 
      phoneNumber, 
      message, 
      listItems, 
      tokenId,
      title = 'Selecione uma opção'
    } = req.body;
    
    // Validar dados obrigatórios
    if (!phoneNumber || !message || !listItems || !Array.isArray(listItems) || !tokenId) {
      return res.status(400).json({
        error: 'Dados obrigatórios: phoneNumber, message, listItems (array), tokenId'
      });
    }
    
    // Validar formato dos itens da lista
    const isValidListItems = listItems.every(item => 
      item.id && item.title && 
      typeof item.id === 'string' && 
      typeof item.title === 'string'
    );
    
    if (!isValidListItems) {
      return res.status(400).json({
        error: 'Formato inválido dos itens da lista. Cada item deve ter id e title (strings)'
      });
    }
    
    console.log(`📤 Enviando mensagem com lista customizada para ${phoneNumber}`);
    
    const result = await sendWhatsAppWithList(
      phoneNumber, 
      message, 
      listItems, 
      tokenId, 
      title
    );
    
    console.log('✅ Mensagem com lista customizada enviada com sucesso');
    
    res.status(200).json({
      success: true,
      message: 'Mensagem com lista enviada com sucesso',
      data: result
    });
    
  } catch (error) {
    console.error('❌ Erro ao enviar mensagem com lista customizada:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
});

// Endpoint para testar conectividade e configuração
router.get('/test', async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Serviço de notificações interativas funcionando',
      timestamp: new Date().toISOString(),
      endpoints: {
        'POST /send-interactive-notification': 'Enviar notificação com botões/lista baseada no tipo de visita',
        'POST /send-custom-buttons': 'Enviar mensagem com botões customizados',
        'POST /send-custom-list': 'Enviar mensagem com lista customizada',
        'GET /test': 'Testar conectividade do serviço'
      }
    });
  } catch (error) {
    console.error('❌ Erro no teste:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
});

module.exports = router;