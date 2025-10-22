// Mapeamento de cores por status
const statusColors = {
  'novo': '#84cc16',
  'form_recebido': '#22d3ee', 
  'conferencia': '#f59e0b',
  'modelagem': '#7dd3fc',
  'paisagismo': '#84cc16',
  'apresentacao': '#8b5cf6',
  'revisao': '#f59e0b',
  'detalhamento': '#06b6d4',
  'entregue': '#10b981'
};

// Mapeamento de próximos passos por status
const nextSteps = {
  'novo': 'Nossa equipe entrará em contato em breve para agendar a primeira reunião.',
  'form_recebido': 'Estamos analisando suas informações e preferências para o projeto.',
  'conferencia': 'Validando todos os detalhes técnicos e requisitos do projeto.',
  'modelagem': 'Criando o modelo 3D do seu espaço com as especificações definidas.',
  'paisagismo': 'Desenvolvendo o design paisagístico e selecionando as plantas ideais.',
  'apresentacao': 'Preparando a apresentação final do seu projeto personalizado.',
  'revisao': 'Aplicando os ajustes solicitados para aperfeiçoar o projeto.',
  'detalhamento': 'Finalizando todos os detalhes técnicos para execução.',
  'entregue': 'Projeto concluído! Acompanhe a execução com nossa equipe.'
};

function renderTemplate(message, type, data = {}) {
  // Dados padrão
  const templateData = {
    clientName: data.clientName || 'Cliente',
    greetingMessage: type === 'client' 
      ? 'Temos novidades sobre o seu projeto de paisagismo!'
      : 'Atualização sobre o projeto em andamento.',
    message: message,
    projectStatus: data.status || 'Em andamento',
    statusColor: statusColors[data.status?.toLowerCase()] || '#7dd3fc',
    professionalName: data.professionalName || 'Equipe Digital Paisagismo',
    estimatedTime: data.estimatedTime || 'A definir',
    nextStep: nextSteps[data.status?.toLowerCase()] || 'Acompanhe as próximas atualizações do seu projeto.'
  };

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Atualização do seu projeto</title>
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); margin: 0; padding: 20px;">
      <div style="max-width: 600px; margin: auto; background: #1a1a1a; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);">
        
        <!-- Header com Logo -->
        <div style="background: linear-gradient(135deg, #7dd3fc 0%, #22d3ee 50%, #84cc16 100%); padding: 30px 25px; text-align: center;">
          <div style="display: inline-block; background: #1a1a1a; padding: 15px 25px; border-radius: 8px; margin-bottom: 15px;">
            <h1 style="color: #7dd3fc; margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 1px;">
              Digital<span style="color: #84cc16;">Paisagismo</span>
            </h1>
          </div>
          <p style="color: #1a1a1a; font-size: 14px; margin: 0; font-weight: 500;">
            Gerenciamento de projetos de paisagismo
          </p>
        </div>

        <!-- Conteúdo Principal -->
        <div style="padding: 40px 30px; background: #1a1a1a;">
          
          <!-- Saudação -->
          <div style="text-align: center; margin-bottom: 30px;">
            <h2 style="color: #ffffff; font-size: 28px; margin: 0 0 10px 0; font-weight: 600;">
              Olá, ${templateData.clientName}!
            </h2>
            <p style="color: #a3a3a3; font-size: 16px; margin: 0; line-height: 1.5;">
              ${templateData.greetingMessage}
            </p>
          </div>

          <!-- Status Badge -->
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="display: inline-block; background: ${templateData.statusColor}; color: #1a1a1a; padding: 8px 20px; border-radius: 20px; font-weight: 600; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">
              ${templateData.projectStatus}
            </div>
          </div>

          <!-- Mensagem Principal -->
          <div style="background: #2d2d2d; border-radius: 8px; padding: 25px; margin-bottom: 30px; border-left: 4px solid #7dd3fc;">
            <div style="color: #ffffff; font-size: 16px; line-height: 1.6;">
              ${templateData.message}
            </div>
          </div>

          <!-- Informações do Projeto -->
          <div style="background: #2d2d2d; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
            <h3 style="color: #7dd3fc; font-size: 18px; margin: 0 0 15px 0; font-weight: 600;">
              📋 Informações do Projeto
            </h3>
            <div style="display: flex; flex-wrap: wrap; gap: 15px;">
              <div style="flex: 1; min-width: 200px;">
                <p style="color: #a3a3a3; font-size: 14px; margin: 0 0 5px 0;">Profissional Responsável:</p>
                <p style="color: #ffffff; font-size: 16px; margin: 0; font-weight: 500;">${templateData.professionalName}</p>
              </div>
              <div style="flex: 1; min-width: 200px;">
                <p style="color: #a3a3a3; font-size: 14px; margin: 0 0 5px 0;">Prazo Estimado:</p>
                <p style="color: #84cc16; font-size: 16px; margin: 0; font-weight: 500;">${templateData.estimatedTime}</p>
              </div>
            </div>
          </div>

          <!-- Timeline/Próximo Passo -->
          <div style="background: #2d2d2d; border-radius: 8px; padding: 20px;">
            <h3 style="color: #84cc16; font-size: 18px; margin: 0 0 15px 0; font-weight: 600;">
              🚀 Próximo Passo
            </h3>
            <p style="color: #ffffff; font-size: 16px; line-height: 1.6; margin: 0;">
              ${templateData.nextStep}
            </p>
          </div>

        </div>

        <!-- Footer -->
        <div style="background: #0f0f0f; padding: 25px 30px; text-align: center; border-top: 1px solid #2d2d2d;">
          <p style="color: #7dd3fc; font-size: 16px; margin: 0 0 10px 0; font-weight: 600;">
            Digital Paisagismo
          </p>
          <p style="color: #a3a3a3; font-size: 14px; margin: 0 0 15px 0; line-height: 1.5;">
            Transformando espaços, criando experiências únicas
          </p>
          <p style="color: #666; font-size: 12px; margin: 0;">
            Este e-mail foi enviado automaticamente. Se você tiver dúvidas, entre em contato conosco.
          </p>
        </div>

      </div>
    </body>
    </html>
  `;
}

module.exports = renderTemplate; 