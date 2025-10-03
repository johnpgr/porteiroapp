const Client = require('socket.io-client');
const { createServer } = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

// Mock dos serviços
jest.mock('../../src/services/webrtcService', () => ({
  createCall: jest.fn(() => Promise.resolve({
    callId: 'test-call-123',
    status: 'initiated',
    createdAt: new Date().toISOString()
  })),
  answerCall: jest.fn(() => Promise.resolve({ status: 'answered' })),
  endCall: jest.fn(() => Promise.resolve({ status: 'ended' })),
  updateCallStatus: jest.fn(() => Promise.resolve({ success: true }))
}));

jest.mock('../../src/services/whatsappService', () => ({
  sendWhatsAppMessage: jest.fn(() => Promise.resolve({ success: true, messageId: 'msg-123' }))
}));

describe('WebRTC Call Simulation Tests', () => {
  let httpServer;
  let io;
  let doormanClient;
  let residentClient;
  let doormanToken;
  let residentToken;
  let port;

  beforeAll((done) => {
    // Criar servidor de teste
    httpServer = createServer();
    io = new Server(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    // Gerar tokens de autenticação
    doormanToken = jwt.sign(
      { userId: 1, role: 'doorman', name: 'Porteiro Teste' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    residentToken = jwt.sign(
      { userId: 2, role: 'resident', name: 'Morador Teste' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Configurar autenticação do servidor
    io.use((socket, next) => {
      const token = socket.handshake.auth.token;
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.userId;
        socket.role = decoded.role;
        socket.userName = decoded.name;
        next();
      } catch (error) {
        next(new Error('Authentication error'));
      }
    });

    // Configurar handlers do servidor
    io.on('connection', (socket) => {
      console.log(`User connected: ${socket.userName} (${socket.role})`);

      // Join room baseado no papel
      socket.join(socket.role === 'doorman' ? 'doormen' : 'residents');

      // Handler para iniciar chamada
      socket.on('webrtc:call-initiate', async (data) => {
        const callData = {
          ...data,
          callId: 'test-call-123',
          from: socket.userId,
          fromName: socket.userName,
          timestamp: new Date().toISOString()
        };

        // Notificar o destinatário
        socket.broadcast.emit('webrtc:incoming-call', callData);
        
        // Confirmar para o iniciador
        socket.emit('webrtc:call-initiated', {
          callId: callData.callId,
          status: 'initiated'
        });
      });

      // Handler para responder chamada
      socket.on('webrtc:call-answer', (data) => {
        const responseData = {
          ...data,
          from: socket.userId,
          fromName: socket.userName,
          timestamp: new Date().toISOString()
        };

        if (data.accept) {
          socket.broadcast.emit('webrtc:call-accepted', responseData);
          socket.emit('webrtc:call-answered', { status: 'answered' });
        } else {
          socket.broadcast.emit('webrtc:call-rejected', responseData);
          socket.emit('webrtc:call-answered', { status: 'rejected' });
        }
      });

      // Handler para sinalização WebRTC
      socket.on('webrtc:offer', (data) => {
        socket.broadcast.emit('webrtc:offer', {
          ...data,
          from: socket.userId
        });
      });

      socket.on('webrtc:answer', (data) => {
        socket.broadcast.emit('webrtc:answer', {
          ...data,
          from: socket.userId
        });
      });

      socket.on('webrtc:ice-candidate', (data) => {
        socket.broadcast.emit('webrtc:ice-candidate', {
          ...data,
          from: socket.userId
        });
      });

      // Handler para encerrar chamada
      socket.on('webrtc:call-end', (data) => {
        const endData = {
          ...data,
          from: socket.userId,
          fromName: socket.userName,
          timestamp: new Date().toISOString()
        };

        socket.broadcast.emit('webrtc:call-ended', endData);
        socket.emit('webrtc:call-end-confirmed', { status: 'ended' });
      });

      socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.userName}`);
      });
    });

    httpServer.listen(() => {
      port = httpServer.address().port;
      done();
    });
  });

  afterAll(() => {
    io.close();
    httpServer.close();
  });

  beforeEach((done) => {
    let connectionsCount = 0;
    const checkConnections = () => {
      connectionsCount++;
      if (connectionsCount === 2) done();
    };

    // Conectar porteiro
    doormanClient = new Client(`http://localhost:${port}`, {
      auth: { token: doormanToken }
    });
    doormanClient.on('connect', checkConnections);

    // Conectar morador
    residentClient = new Client(`http://localhost:${port}`, {
      auth: { token: residentToken }
    });
    residentClient.on('connect', checkConnections);
  });

  afterEach(() => {
    if (doormanClient && doormanClient.connected) {
      doormanClient.disconnect();
    }
    if (residentClient && residentClient.connected) {
      residentClient.disconnect();
    }
  });

  describe('Fluxo Completo de Chamada - Aceita', () => {
    it('deve simular chamada completa aceita pelo morador', (done) => {
      const callData = {
        residentId: 2,
        callType: 'video',
        reason: 'Visitante na portaria'
      };

      let callId;
      let stepsCompleted = 0;
      const totalSteps = 6;

      const checkCompletion = () => {
        stepsCompleted++;
        if (stepsCompleted === totalSteps) {
          done();
        }
      };

      // 1. Porteiro inicia chamada
      doormanClient.emit('webrtc:call-initiate', callData);

      // 2. Porteiro recebe confirmação
      doormanClient.on('webrtc:call-initiated', (data) => {
        expect(data.status).toBe('initiated');
        callId = data.callId;
        checkCompletion();
      });

      // 3. Morador recebe chamada
      residentClient.on('webrtc:incoming-call', (data) => {
        expect(data.residentId).toBe(callData.residentId);
        expect(data.callType).toBe(callData.callType);
        expect(data.from).toBe(1);
        callId = data.callId;
        checkCompletion();

        // 4. Morador aceita chamada
        setTimeout(() => {
          residentClient.emit('webrtc:call-answer', {
            callId: callId,
            accept: true
          });
        }, 100);
      });

      // 5. Porteiro recebe aceitação
      doormanClient.on('webrtc:call-accepted', (data) => {
        expect(data.callId).toBe(callId);
        expect(data.from).toBe(2);
        checkCompletion();

        // Simular sinalização WebRTC
        setTimeout(() => {
          doormanClient.emit('webrtc:offer', {
            callId: callId,
            sdp: 'mock-offer-sdp',
            type: 'offer'
          });
        }, 100);
      });

      // 6. Morador recebe offer
      residentClient.on('webrtc:offer', (data) => {
        expect(data.callId).toBe(callId);
        expect(data.sdp).toBe('mock-offer-sdp');
        checkCompletion();

        // Responder com answer
        setTimeout(() => {
          residentClient.emit('webrtc:answer', {
            callId: callId,
            sdp: 'mock-answer-sdp',
            type: 'answer'
          });
        }, 100);
      });

      // 7. Porteiro recebe answer
      doormanClient.on('webrtc:answer', (data) => {
        expect(data.callId).toBe(callId);
        expect(data.sdp).toBe('mock-answer-sdp');
        checkCompletion();

        // Simular ICE candidates
        setTimeout(() => {
          doormanClient.emit('webrtc:ice-candidate', {
            callId: callId,
            candidate: 'mock-ice-candidate',
            sdpMLineIndex: 0
          });
        }, 100);
      });

      // 8. Morador recebe ICE candidate
      residentClient.on('webrtc:ice-candidate', (data) => {
        expect(data.callId).toBe(callId);
        expect(data.candidate).toBe('mock-ice-candidate');
        checkCompletion();
      });
    });
  });

  describe('Fluxo Completo de Chamada - Rejeitada', () => {
    it('deve simular chamada rejeitada pelo morador', (done) => {
      const callData = {
        residentId: 2,
        callType: 'video',
        reason: 'Visitante na portaria'
      };

      let callId;
      let stepsCompleted = 0;
      const totalSteps = 3;

      const checkCompletion = () => {
        stepsCompleted++;
        if (stepsCompleted === totalSteps) {
          done();
        }
      };

      // 1. Porteiro inicia chamada
      doormanClient.emit('webrtc:call-initiate', callData);

      // 2. Morador recebe chamada
      residentClient.on('webrtc:incoming-call', (data) => {
        callId = data.callId;
        checkCompletion();

        // Morador rejeita chamada
        setTimeout(() => {
          residentClient.emit('webrtc:call-answer', {
            callId: callId,
            accept: false,
            reason: 'busy'
          });
        }, 100);
      });

      // 3. Porteiro recebe rejeição
      doormanClient.on('webrtc:call-rejected', (data) => {
        expect(data.callId).toBe(callId);
        expect(data.reason).toBe('busy');
        checkCompletion();
      });

      // 4. Morador recebe confirmação
      residentClient.on('webrtc:call-answered', (data) => {
        expect(data.status).toBe('rejected');
        checkCompletion();
      });
    });
  });

  describe('Encerramento de Chamada', () => {
    it('deve encerrar chamada iniciada pelo porteiro', (done) => {
      const callId = 'test-call-123';
      let stepsCompleted = 0;
      const totalSteps = 2;

      const checkCompletion = () => {
        stepsCompleted++;
        if (stepsCompleted === totalSteps) {
          done();
        }
      };

      // Porteiro encerra chamada
      doormanClient.emit('webrtc:call-end', {
        callId: callId,
        reason: 'completed'
      });

      // Morador recebe notificação de encerramento
      residentClient.on('webrtc:call-ended', (data) => {
        expect(data.callId).toBe(callId);
        expect(data.reason).toBe('completed');
        expect(data.from).toBe(1);
        checkCompletion();
      });

      // Porteiro recebe confirmação
      doormanClient.on('webrtc:call-end-confirmed', (data) => {
        expect(data.status).toBe('ended');
        checkCompletion();
      });
    });

    it('deve encerrar chamada iniciada pelo morador', (done) => {
      const callId = 'test-call-123';
      let stepsCompleted = 0;
      const totalSteps = 2;

      const checkCompletion = () => {
        stepsCompleted++;
        if (stepsCompleted === totalSteps) {
          done();
        }
      };

      // Morador encerra chamada
      residentClient.emit('webrtc:call-end', {
        callId: callId,
        reason: 'user_ended'
      });

      // Porteiro recebe notificação de encerramento
      doormanClient.on('webrtc:call-ended', (data) => {
        expect(data.callId).toBe(callId);
        expect(data.reason).toBe('user_ended');
        expect(data.from).toBe(2);
        checkCompletion();
      });

      // Morador recebe confirmação
      residentClient.on('webrtc:call-end-confirmed', (data) => {
        expect(data.status).toBe('ended');
        checkCompletion();
      });
    });
  });

  describe('Cenários de Erro', () => {
    it('deve lidar com desconexão durante chamada', (done) => {
      const callData = {
        residentId: 2,
        callType: 'video'
      };

      // Iniciar chamada
      doormanClient.emit('webrtc:call-initiate', callData);

      residentClient.on('webrtc:incoming-call', () => {
        // Simular desconexão do morador
        residentClient.disconnect();
        
        // Verificar se o porteiro ainda está conectado
        setTimeout(() => {
          expect(doormanClient.connected).toBe(true);
          done();
        }, 500);
      });
    });

    it('deve lidar com timeout de resposta', (done) => {
      const callData = {
        residentId: 2,
        callType: 'video'
      };

      doormanClient.emit('webrtc:call-initiate', callData);

      residentClient.on('webrtc:incoming-call', () => {
        // Não responder à chamada (simular timeout)
        // Em um cenário real, haveria um timeout automático
      });

      // Simular timeout após 30 segundos (reduzido para teste)
      setTimeout(() => {
        expect(doormanClient.connected).toBe(true);
        expect(residentClient.connected).toBe(true);
        done();
      }, 1000);
    });
  });
});