const Client = require('socket.io-client');
const { createServer } = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

// Mock do serviço WebRTC
jest.mock('../../src/services/webrtcService', () => ({
  createCall: jest.fn(() => Promise.resolve({ callId: 'test-call-id', status: 'initiated' })),
  answerCall: jest.fn(() => Promise.resolve({ status: 'answered' })),
  endCall: jest.fn(() => Promise.resolve({ status: 'ended' })),
  handleSignaling: jest.fn(() => Promise.resolve({ success: true }))
}));

describe('WebRTC WebSocket Signaling Tests', () => {
  let httpServer;
  let io;
  let serverSocket;
  let clientSocket;
  let authToken;
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

    // Gerar token de autenticação
    authToken = jwt.sign(
      { userId: 1, role: 'doorman' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Configurar handlers do servidor
    io.use((socket, next) => {
      const token = socket.handshake.auth.token;
      if (token === authToken) {
        socket.userId = 1;
        socket.role = 'doorman';
        next();
      } else {
        next(new Error('Authentication error'));
      }
    });

    io.on('connection', (socket) => {
      serverSocket = socket;
      
      // Handlers de sinalização WebRTC
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

      socket.on('webrtc:call-initiate', (data) => {
        socket.broadcast.emit('webrtc:incoming-call', {
          ...data,
          from: socket.userId,
          callId: 'test-call-id'
        });
      });

      socket.on('webrtc:call-end', (data) => {
        socket.broadcast.emit('webrtc:call-ended', {
          ...data,
          from: socket.userId
        });
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
    // Criar cliente de teste
    clientSocket = new Client(`http://localhost:${port}`, {
      auth: {
        token: authToken
      }
    });
    clientSocket.on('connect', done);
  });

  afterEach(() => {
    if (clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  describe('Conexão WebSocket', () => {
    it('deve conectar com autenticação válida', (done) => {
      expect(clientSocket.connected).toBe(true);
      done();
    });

    it('deve rejeitar conexão sem autenticação', (done) => {
      const unauthorizedClient = new Client(`http://localhost:${port}`);
      
      unauthorizedClient.on('connect_error', (error) => {
        expect(error.message).toBe('Authentication error');
        unauthorizedClient.disconnect();
        done();
      });
    });
  });

  describe('Sinalização WebRTC', () => {
    let secondClient;

    beforeEach((done) => {
      // Criar segundo cliente para simular comunicação
      secondClient = new Client(`http://localhost:${port}`, {
        auth: {
          token: authToken
        }
      });
      secondClient.on('connect', done);
    });

    afterEach(() => {
      if (secondClient && secondClient.connected) {
        secondClient.disconnect();
      }
    });

    it('deve transmitir offer WebRTC', (done) => {
      const offerData = {
        callId: 'test-call-id',
        sdp: 'test-offer-sdp',
        type: 'offer'
      };

      secondClient.on('webrtc:offer', (data) => {
        expect(data.callId).toBe(offerData.callId);
        expect(data.sdp).toBe(offerData.sdp);
        expect(data.from).toBe(1);
        done();
      });

      clientSocket.emit('webrtc:offer', offerData);
    });

    it('deve transmitir answer WebRTC', (done) => {
      const answerData = {
        callId: 'test-call-id',
        sdp: 'test-answer-sdp',
        type: 'answer'
      };

      secondClient.on('webrtc:answer', (data) => {
        expect(data.callId).toBe(answerData.callId);
        expect(data.sdp).toBe(answerData.sdp);
        expect(data.from).toBe(1);
        done();
      });

      clientSocket.emit('webrtc:answer', answerData);
    });

    it('deve transmitir ICE candidates', (done) => {
      const iceData = {
        callId: 'test-call-id',
        candidate: 'test-ice-candidate',
        sdpMLineIndex: 0
      };

      secondClient.on('webrtc:ice-candidate', (data) => {
        expect(data.callId).toBe(iceData.callId);
        expect(data.candidate).toBe(iceData.candidate);
        expect(data.from).toBe(1);
        done();
      });

      clientSocket.emit('webrtc:ice-candidate', iceData);
    });

    it('deve iniciar chamada e notificar destinatário', (done) => {
      const callData = {
        residentId: 2,
        callType: 'video'
      };

      secondClient.on('webrtc:incoming-call', (data) => {
        expect(data.residentId).toBe(callData.residentId);
        expect(data.callType).toBe(callData.callType);
        expect(data.callId).toBe('test-call-id');
        expect(data.from).toBe(1);
        done();
      });

      clientSocket.emit('webrtc:call-initiate', callData);
    });

    it('deve encerrar chamada e notificar participantes', (done) => {
      const endData = {
        callId: 'test-call-id',
        reason: 'completed'
      };

      secondClient.on('webrtc:call-ended', (data) => {
        expect(data.callId).toBe(endData.callId);
        expect(data.reason).toBe(endData.reason);
        expect(data.from).toBe(1);
        done();
      });

      clientSocket.emit('webrtc:call-end', endData);
    });
  });

  describe('Reconexão e Recuperação', () => {
    it('deve reconectar automaticamente após desconexão', (done) => {
      let reconnected = false;

      clientSocket.on('disconnect', () => {
        expect(clientSocket.connected).toBe(false);
      });

      clientSocket.on('connect', () => {
        if (reconnected) {
          expect(clientSocket.connected).toBe(true);
          done();
        } else {
          reconnected = true;
          // Simular desconexão
          clientSocket.disconnect();
          // Reconectar
          setTimeout(() => {
            clientSocket.connect();
          }, 100);
        }
      });

      // Primeira desconexão para testar reconexão
      if (!reconnected) {
        clientSocket.disconnect();
        setTimeout(() => {
          clientSocket.connect();
        }, 100);
      }
    });
  });
});