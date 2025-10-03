const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

// Mock completo do Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn((token) => {
        if (token === 'valid-token') {
          return Promise.resolve({
            data: { user: { id: 'user-1', email: 'test@test.com' } },
            error: null
          });
        }
        return Promise.resolve({ data: { user: null }, error: { message: 'Invalid token' } });
      })
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({
            data: { 
              id: 'user-1', 
              name: 'Test User', 
              user_type: 'porteiro', 
              webrtc_enabled: true 
            },
            error: null
          }))
        }))
      }))
    }))
  }))
}));

// Mock do middleware de autenticação
const { authenticateWebRTC, requireAdmin, requirePorteiro, requireMorador } = require('../../src/middleware/webrtcAuth');

// Criar app de teste
const app = express();
app.use(express.json());

// Rota de teste protegida
app.get('/test-protected', authenticateWebRTC, (req, res) => {
  res.json({ 
    message: 'Access granted', 
    user: req.user 
  });
});

// Mock do Supabase para validação de usuários
jest.mock('../../src/services/supabaseClient', () => ({
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(() => {
          const mockUsers = {
            1: { id: 1, name: 'Porteiro Teste', role: 'doorman', active: true },
            2: { id: 2, name: 'Morador Teste', role: 'resident', active: true },
            3: { id: 3, name: 'Admin Teste', role: 'admin', active: true },
            4: { id: 4, name: 'Usuário Inativo', role: 'resident', active: false }
          };
          
          return Promise.resolve({ 
            data: mockUsers[1] || null, 
            error: null 
          });
        })
      }))
    }))
  }))
}));

describe('WebRTC Authentication Tests', () => {
  beforeAll(() => {
    // Configurar variáveis de ambiente para teste
    process.env.JWT_SECRET = 'test-secret';
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-key';
  });

  describe('Token Generation', () => {
    it('deve gerar token válido para porteiro', () => {
      const token = jwt.sign(
        { userId: 'porteiro-1', role: 'porteiro' },
        process.env.JWT_SECRET || 'test-secret'
      );
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('deve gerar token válido para morador', () => {
      const token = jwt.sign(
        { userId: 'resident-1', role: 'resident' },
        process.env.JWT_SECRET || 'test-secret'
      );
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('deve gerar token com expiração correta', () => {
      const payload = { userId: 1, role: 'doorman' };
      const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '2h' });
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const now = Math.floor(Date.now() / 1000);
      const expectedExp = now + (2 * 60 * 60); // 2 horas
      
      expect(decoded.exp).toBeGreaterThan(now);
      expect(decoded.exp).toBeLessThanOrEqual(expectedExp + 10); // Margem de 10 segundos
    });
  });

  describe('Token Validation', () => {
    it('deve validar token válido', () => {
      const payload = { userId: 'test-1', role: 'porteiro' };
      const token = jwt.sign(payload, process.env.JWT_SECRET || 'test-secret');
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-secret');
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.role).toBe(payload.role);
    });

    it('deve rejeitar token inválido', () => {
      expect(() => {
        jwt.verify('invalid-token', process.env.JWT_SECRET || 'test-secret');
      }).toThrow();
    });
  });

  describe('WebSocket Authentication', () => {
    it('deve validar token para conexão WebSocket', () => {
      const token = jwt.sign(
        { userId: 1, role: 'doorman' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      // Simular validação de token WebSocket
      const mockSocket = {
        handshake: {
          auth: { token }
        }
      };

      const decoded = jwt.verify(mockSocket.handshake.auth.token, process.env.JWT_SECRET);
      expect(decoded.userId).toBe(1);
      expect(decoded.role).toBe('doorman');
    });

    it('deve rejeitar token inválido para WebSocket', () => {
      const invalidToken = 'invalid.token';

      const mockSocket = {
        handshake: {
          auth: { token: invalidToken }
        }
      };

      expect(() => {
        jwt.verify(mockSocket.handshake.auth.token, process.env.JWT_SECRET);
      }).toThrow();
    });
  });

  describe('Security Tests', () => {
    it('deve rejeitar token com secret incorreto', () => {
      const tokenWithWrongSecret = jwt.sign(
        { userId: 1, role: 'doorman' },
        'wrong-secret',
        { expiresIn: '1h' }
      );

      expect(() => {
        jwt.verify(tokenWithWrongSecret, process.env.JWT_SECRET);
      }).toThrow();
    });

    it('deve rejeitar token modificado', () => {
      const validToken = jwt.sign(
        { userId: 1, role: 'doorman' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      // Modificar o token
      const modifiedToken = validToken.slice(0, -5) + 'XXXXX';

      expect(() => {
        jwt.verify(modifiedToken, process.env.JWT_SECRET);
      }).toThrow();
    });

    it('deve validar estrutura do payload', () => {
      const token = jwt.sign(
        { userId: 1, role: 'doorman', extra: 'data' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      expect(decoded).toHaveProperty('userId');
      expect(decoded).toHaveProperty('role');
      expect(decoded).toHaveProperty('iat');
      expect(decoded).toHaveProperty('exp');
    });
  });
});