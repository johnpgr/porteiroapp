const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

// Mock da aplicação principal
const webrtcRoutes = require('../../src/routes/webrtcRoutes');
const app = express();
app.use(express.json());
app.use('/api/webrtc', webrtcRoutes);

// Mock completo do Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn(() => Promise.resolve({
        data: { user: { id: 'user-1', email: 'test@test.com' } },
        error: null
      }))
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({
            data: { id: 'user-1', name: 'Test User', user_type: 'porteiro', webrtc_enabled: true },
            error: null
          })),
          order: jest.fn(() => Promise.resolve({
            data: mockResidents,
            error: null
          }))
        }))
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({
            data: { id: 1, caller_id: 'user-1', receiver_id: 'user-2', status: 'initiated' },
            error: null
          }))
        }))
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: { id: 1 }, error: null }))
      }))
    }))
  }))
}));

// Mock do serviço de notificações
jest.mock('../../src/services/whatsappService', () => ({
  sendWhatsAppMessage: jest.fn(() => Promise.resolve({ success: true, messageId: 'msg-123' }))
}));

describe('WebRTC API Tests', () => {
  let authToken;
  
  beforeAll(() => {
    // Gerar token de autenticação para testes
    authToken = jwt.sign(
      { userId: 1, role: 'doorman' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  describe('POST /api/webrtc/call/initiate', () => {
    it('deve iniciar uma chamada com sucesso', async () => {
      const callData = {
        residentId: 1,
        callType: 'video'
      };

      const response = await request(app)
        .post('/api/webrtc/webrtc/call/initiate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(callData)
        .expect(201);

      expect(response.body).toHaveProperty('callId');
      expect(response.body).toHaveProperty('status', 'initiated');
      expect(response.body).toHaveProperty('signalData');
    });

    it('deve retornar erro 400 para dados inválidos', async () => {
      const invalidData = {
        residentId: 'invalid',
        callType: 'invalid_type'
      };

      const response = await request(app)
        .post('/api/webrtc/webrtc/call/initiate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('deve retornar erro 401 sem autenticação', async () => {
      const callData = {
        residentId: 1,
        callType: 'video'
      };

      await request(app)
        .post('/api/webrtc/webrtc/call/initiate')
        .send(callData)
        .expect(401);
    });
  });

  describe('POST /api/webrtc/call/answer', () => {
    it('deve responder uma chamada com sucesso', async () => {
      const answerData = {
        callId: 'test-call-id',
        signalData: { type: 'answer', sdp: 'test-sdp' },
        accept: true
      };

      const response = await request(app)
        .post('/api/webrtc/webrtc/call/answer')
        .set('Authorization', `Bearer ${authToken}`)
        .send(answerData)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'answered');
    });

    it('deve rejeitar uma chamada com sucesso', async () => {
      const rejectData = {
        callId: 'test-call-id',
        accept: false,
        reason: 'busy'
      };

      const response = await request(app)
        .post('/api/webrtc/webrtc/call/answer')
        .set('Authorization', `Bearer ${authToken}`)
        .send(rejectData)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'rejected');
    });
  });

  describe('POST /api/webrtc/call/end', () => {
    it('deve encerrar uma chamada com sucesso', async () => {
      const endData = {
        callId: 'test-call-id',
        reason: 'completed'
      };

      const response = await request(app)
        .post('/api/webrtc/webrtc/call/end')
        .set('Authorization', `Bearer ${authToken}`)
        .send(endData)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ended');
    });
  });

  describe('GET /api/webrtc/residents', () => {
    it('deve listar moradores disponíveis', async () => {
      const response = await request(app)
        .get('/api/webrtc/webrtc/residents')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('residents');
      expect(Array.isArray(response.body.residents)).toBe(true);
    });
  });

  describe('GET /api/webrtc/call/:callId/status', () => {
    it('deve retornar status de uma chamada', async () => {
      const callId = 'test-call-id';

      const response = await request(app)
        .get(`/api/webrtc/webrtc/call/${callId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('callId', callId);
      expect(response.body).toHaveProperty('status');
    });
  });
});