# Planejamento Técnico: Sistema de Cadastro via Site Next.js

## 1. ANÁLISE DOS PROBLEMAS ATUAIS

### 1.1 Problemas Identificados no Fluxo de Cadastro

#### Em `app/admin/users.tsx`:
- **Problema de Redirecionamento**: Após o cadastro em lote, os usuários são redirecionados via WhatsApp mas não há validação se completaram o cadastro
- **Falta de Token de Validação**: O sistema gera tokens mas não há validação adequada de expiração
- **Processo Incompleto**: O fluxo termina no envio do WhatsApp, sem garantir que o usuário complete o cadastro

#### Em `app/morador/visitantes/VisitantesTab.tsx`:
- **Pré-cadastro Incompleto**: Visitantes são pré-cadastrados mas o processo de finalização via link não está implementado
- **Validação de Token Ausente**: Tokens são gerados mas não há sistema robusto de validação
- **Experiência Fragmentada**: O usuário recebe um link mas não há uma página dedicada para completar o cadastro

#### Problemas Gerais:
- **Falta de Integração Web**: O app mobile não tem integração com uma interface web para cadastros
- **Tokens Sem Expiração Adequada**: Sistema de tokens não tem controle rigoroso de expiração
- **Fluxo Interrompido**: Usuários podem não completar o cadastro, ficando em estado pendente

### 1.2 Impactos dos Problemas
- Usuários ficam em estado "pré-cadastrado" indefinidamente
- Administradores não têm visibilidade do status real dos cadastros
- Experiência do usuário fragmentada entre app e web
- Possíveis problemas de segurança com tokens sem expiração adequada

## 2. ARQUITETURA DA SOLUÇÃO

### 2.1 Visão Geral da Arquitetura

```mermaid
graph TD
    A[App Mobile] --> B[Supabase Database]
    C[Site Next.js] --> B
    D[WhatsApp API] --> E[Links Dinâmicos]
    E --> C
    
    subgraph "Fluxo de Cadastro"
        F[Admin cria usuário] --> G[Token gerado]
        G --> H[Link enviado via WhatsApp]
        H --> I[Usuário acessa site]
        I --> J[Cadastro completo]
        J --> K[Redirecionamento]
    end
    
    subgraph "Validação de Tokens"
        L[Token com expiração]
        M[Validação no servidor]
        N[Status atualizado no banco]
    end
```

### 2.2 Estrutura das Novas Rotas

#### Rotas do Site Next.js:
1. **`/cadastro/morador/[token]`** - Finalização de cadastro de morador
2. **`/cadastro/visitante/[token]`** - Finalização de cadastro de visitante
3. **`/visita/[token]`** - Aprovação/rejeição de visita pelo morador

#### Estrutura de Diretórios:
```
porteiro-site/src/app/
├── cadastro/
│   ├── morador/
│   │   └── [token]/
│   │       └── page.tsx
│   └── visitante/
│       └── [token]/
│           └── page.tsx
├── visita/
│   └── [token]/
│       └── page.tsx
├── components/
│   ├── forms/
│   │   ├── MoradorForm.tsx
│   │   ├── VisitanteForm.tsx
│   │   └── VisitaApprovalForm.tsx
│   └── ui/
│       ├── TokenValidator.tsx
│       └── LoadingSpinner.tsx
└── lib/
    ├── supabase.ts
    ├── token-validation.ts
    └── whatsapp-integration.ts
```

### 2.3 Sistema de Tokens Seguro

#### Estrutura do Token:
```typescript
interface TokenData {
  id: string;
  type: 'user_registration' | 'visitor_registration' | 'visit_approval';
  user_id?: string;
  visitor_id?: string;
  visit_id?: string;
  expires_at: string;
  used: boolean;
  created_at: string;
  metadata?: Record<string, any>;
}
```

#### Validação de Token:
- **Expiração**: 24 horas para cadastros, 7 dias para aprovação de visitas
- **Uso único**: Token invalidado após uso
- **Tipo específico**: Cada token tem um tipo específico
- **Metadados**: Informações adicionais conforme necessário

## 3. IMPLEMENTAÇÃO TÉCNICA

### 3.1 Configuração do Supabase no Site Next.js

```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database';

const supabaseUrl = 'https://ycamhxzumzkpxuhtugxc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYW1oeHp1bXprcHh1aHR1Z3hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3MjEwMzEsImV4cCI6MjA3MTI5NzAzMX0.CBgkeAVbxlyJHftmVWSkSPefrbOdMckMvtakRTDpgc8';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
```

### 3.2 Página de Cadastro de Morador

```typescript
// app/cadastro/morador/[token]/page.tsx
import { TokenValidator } from '@/components/ui/TokenValidator';
import { MoradorForm } from '@/components/forms/MoradorForm';

interface PageProps {
  params: { token: string };
}

export default async function CadastroMoradorPage({ params }: PageProps) {
  return (
    <TokenValidator 
      token={params.token} 
      expectedType="user_registration"
      onValidToken={(tokenData) => (
        <MoradorForm 
          token={params.token}
          tokenData={tokenData}
          onComplete={() => {
            // Redirecionar para página de sucesso
            window.location.href = '/cadastro/sucesso';
          }}
        />
      )}
      onInvalidToken={() => (
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold text-red-600">Token Inválido</h1>
          <p>Este link expirou ou já foi utilizado.</p>
        </div>
      )}
    />
  );
}
```

### 3.3 Componente de Validação de Token

```typescript
// components/ui/TokenValidator.tsx
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { LoadingSpinner } from './LoadingSpinner';

interface TokenValidatorProps {
  token: string;
  expectedType: string;
  onValidToken: (tokenData: any) => React.ReactNode;
  onInvalidToken: () => React.ReactNode;
}

export function TokenValidator({ 
  token, 
  expectedType, 
  onValidToken, 
  onInvalidToken 
}: TokenValidatorProps) {
  const [loading, setLoading] = useState(true);
  const [tokenData, setTokenData] = useState(null);
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    validateToken();
  }, [token]);

  const validateToken = async () => {
    try {
      const { data, error } = await supabase
        .from('registration_tokens')
        .select('*')
        .eq('id', token)
        .eq('type', expectedType)
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error || !data) {
        setIsValid(false);
      } else {
        setTokenData(data);
        setIsValid(true);
      }
    } catch (error) {
      console.error('Erro ao validar token:', error);
      setIsValid(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return isValid ? onValidToken(tokenData) : onInvalidToken();
}
```

### 3.4 Formulário de Cadastro de Morador

```typescript
// components/forms/MoradorForm.tsx
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface MoradorFormProps {
  token: string;
  tokenData: any;
  onComplete: () => void;
}

export function MoradorForm({ token, tokenData, onComplete }: MoradorFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    document: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Criar usuário no Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: generateTemporaryPassword(),
        options: {
          data: {
            name: formData.name,
            phone: formData.phone,
          }
        }
      });

      if (authError) throw authError;

      // 2. Atualizar profile com dados completos
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          name: formData.name,
          phone: formData.phone,
          document: formData.document,
          registration_completed: true,
        })
        .eq('user_id', authData.user?.id);

      if (profileError) throw profileError;

      // 3. Marcar token como usado
      const { error: tokenError } = await supabase
        .from('registration_tokens')
        .update({ used: true })
        .eq('id', token);

      if (tokenError) throw tokenError;

      // 4. Enviar email de confirmação
      await sendWelcomeEmail(formData.email, formData.name);

      onComplete();
    } catch (error) {
      console.error('Erro ao completar cadastro:', error);
      alert('Erro ao completar cadastro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-6 text-center">Complete seu Cadastro</h1>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Nome Completo</label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            className="w-full p-2 border rounded-md"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            required
            value={formData.email}
            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
            className="w-full p-2 border rounded-md"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Telefone</label>
          <input
            type="tel"
            required
            value={formData.phone}
            onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
            className="w-full p-2 border rounded-md"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">CPF</label>
          <input
            type="text"
            required
            value={formData.document}
            onChange={(e) => setFormData(prev => ({ ...prev, document: e.target.value }))}
            className="w-full p-2 border rounded-md"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white p-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Cadastrando...' : 'Completar Cadastro'}
        </button>
      </form>
    </div>
  );
}
```

### 3.5 Sistema de Notificações WhatsApp Integrado

```typescript
// lib/whatsapp-integration.ts
import { supabase } from './supabase';

export async function sendRegistrationLink(
  phone: string, 
  token: string, 
  type: 'morador' | 'visitante'
) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://porteiro-site.vercel.app';
  const link = `${baseUrl}/cadastro/${type}/${token}`;
  
  const message = type === 'morador' 
    ? `🏠 Complete seu cadastro como morador: ${link}`
    : `👋 Complete seu cadastro como visitante: ${link}`;

  // Integração com API do WhatsApp
  return await sendWhatsAppMessage(phone, message);
}

export async function sendVisitApprovalLink(
  phone: string, 
  token: string, 
  visitorName: string
) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://porteiro-site.vercel.app';
  const link = `${baseUrl}/visita/${token}`;
  
  const message = `🔔 ${visitorName} está solicitando uma visita. Clique para aprovar ou rejeitar: ${link}`;

  return await sendWhatsAppMessage(phone, message);
}
```

## 4. CORREÇÕES NECESSÁRIAS

### 4.1 Correções em `app/admin/users.tsx`

```typescript
// Adicionar após a criação do usuário
const generateRegistrationToken = async (userId: string) => {
  const token = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24); // 24 horas para expirar

  const { error } = await supabase
    .from('registration_tokens')
    .insert({
      id: token,
      type: 'user_registration',
      user_id: userId,
      expires_at: expiresAt.toISOString(),
      used: false,
    });

  if (error) throw error;
  return token;
};

// Modificar handleBulkRegistration
const handleBulkRegistration = async () => {
  // ... código existente ...
  
  for (const user of selectedUsers) {
    try {
      // Criar usuário
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .insert({
          name: user.name,
          phone: user.phone,
          registration_completed: false, // Importante: marcar como não completado
        })
        .select()
        .single();

      if (userError) throw userError;

      // Gerar token de registro
      const token = await generateRegistrationToken(userData.id);

      // Enviar link via WhatsApp
      await sendRegistrationLink(user.phone, token, 'morador');

      // Atualizar status para "link_sent"
      await supabase
        .from('profiles')
        .update({ status: 'link_sent' })
        .eq('id', userData.id);

    } catch (error) {
      console.error(`Erro ao processar usuário ${user.name}:`, error);
    }
  }
};
```

### 4.2 Correções em `app/morador/visitantes/VisitantesTab.tsx`

```typescript
// Adicionar função para gerar token de visitante
const generateVisitorRegistrationToken = async (visitorId: string) => {
  const token = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  const { error } = await supabase
    .from('registration_tokens')
    .insert({
      id: token,
      type: 'visitor_registration',
      visitor_id: visitorId,
      expires_at: expiresAt.toISOString(),
      used: false,
    });

  if (error) throw error;
  return token;
};

// Modificar função de pré-cadastro
const handlePreRegistration = async () => {
  try {
    // Criar visitante com status "pre_registered"
    const { data: visitorData, error: visitorError } = await supabase
      .from('visitors')
      .insert({
        name: preRegistrationData.name,
        phone: preRegistrationData.phone,
        status: 'pre_registered',
        visitor_type: preRegistrationData.visitor_type,
        apartment_id: apartmentId,
        registration_completed: false,
      })
      .select()
      .single();

    if (visitorError) throw visitorError;

    // Gerar token de registro
    const token = await generateVisitorRegistrationToken(visitorData.id);

    // Enviar link via WhatsApp
    await sendRegistrationLink(preRegistrationData.phone, token, 'visitante');

    // Atualizar status
    await supabase
      .from('visitors')
      .update({ status: 'link_sent' })
      .eq('id', visitorData.id);

    Alert.alert('Sucesso', 'Link de cadastro enviado via WhatsApp!');
    setShowPreRegistrationModal(false);
    
  } catch (error) {
    console.error('Erro no pré-cadastro:', error);
    Alert.alert('Erro', 'Falha ao enviar link de cadastro.');
  }
};
```

### 4.3 Melhorias no Sistema de Tokens

```sql
-- Criar tabela de tokens se não existir
CREATE TABLE IF NOT EXISTS registration_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL CHECK (type IN ('user_registration', 'visitor_registration', 'visit_approval')),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  visitor_id UUID REFERENCES visitors(id) ON DELETE CASCADE,
  visit_id UUID REFERENCES visits(id) ON DELETE CASCADE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Índices para performance
CREATE INDEX idx_registration_tokens_type ON registration_tokens(type);
CREATE INDEX idx_registration_tokens_expires_at ON registration_tokens(expires_at);
CREATE INDEX idx_registration_tokens_used ON registration_tokens(used);

-- Função para limpar tokens expirados
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM registration_tokens 
  WHERE expires_at < NOW() OR used = TRUE;
END;
$$ LANGUAGE plpgsql;
```

## 5. FLUXO DE USUÁRIO

### 5.1 Jornada do Morador

```mermaid
sequenceDiagram
    participant A as Admin
    participant S as Sistema
    participant W as WhatsApp
    participant M as Morador
    participant Site as Site Next.js
    participant DB as Supabase

    A->>S: Cadastra morador em lote
    S->>DB: Cria profile (incomplete)
    S->>DB: Gera token de registro
    S->>W: Envia link via WhatsApp
    W->>M: Recebe link de cadastro
    M->>Site: Clica no link
    Site->>DB: Valida token
    Site->>M: Exibe formulário
    M->>Site: Preenche dados
    Site->>DB: Completa cadastro
    Site->>DB: Marca token como usado
    Site->>M: Redireciona para sucesso
```

### 5.2 Jornada do Visitante

```mermaid
sequenceDiagram
    participant M as Morador
    participant App as App Mobile
    participant DB as Supabase
    participant W as WhatsApp
    participant V as Visitante
    participant Site as Site Next.js

    M->>App: Pré-cadastra visitante
    App->>DB: Cria visitor (pre_registered)
    App->>DB: Gera token de registro
    App->>W: Envia link via WhatsApp
    W->>V: Recebe link de cadastro
    V->>Site: Clica no link
    Site->>DB: Valida token
    Site->>V: Exibe formulário
    V->>Site: Preenche dados + foto
    Site->>DB: Completa cadastro
    Site->>DB: Marca token como usado
    Site->>V: Redireciona para sucesso
```

### 5.3 Jornada de Aprovação de Visita

```mermaid
sequenceDiagram
    participant P as Porteiro
    participant App as App Mobile
    participant DB as Supabase
    participant W as WhatsApp
    participant M as Morador
    participant Site as Site Next.js

    P->>App: Registra chegada de visitante
    App->>DB: Cria solicitação de visita
    App->>DB: Gera token de aprovação
    App->>W: Envia link para morador
    W->>M: Recebe link de aprovação
    M->>Site: Clica no link
    Site->>DB: Valida token
    Site->>M: Exibe dados da visita
    M->>Site: Aprova ou rejeita
    Site->>DB: Atualiza status da visita
    Site->>DB: Marca token como usado
    Site->>App: Notifica porteiro
    Site->>M: Confirma ação
```

## 6. CONSIDERAÇÕES DE SEGURANÇA

### 6.1 Validação de Tokens
- Tokens com expiração obrigatória
- Uso único por token
- Validação de tipo específico
- Limpeza automática de tokens expirados

### 6.2 Proteção de Dados
- Validação de entrada em todos os formulários
- Sanitização de dados antes do armazenamento
- Criptografia de dados sensíveis
- Rate limiting para prevenir spam

### 6.3 Autenticação
- Integração com Supabase Auth
- Sessões seguras
- Logout automático após inatividade
- Verificação de email obrigatória

## 7. MONITORAMENTO E MÉTRICAS

### 7.1 Métricas de Conversão
- Taxa de cliques em links enviados
- Taxa de conclusão de cadastros
- Tempo médio para completar cadastro
- Taxa de tokens expirados

### 7.2 Logs e Auditoria
- Log de todas as ações de cadastro
- Rastreamento de tokens utilizados
- Histórico de tentativas de acesso
- Alertas para atividades suspeitas

## 8. CRONOGRAMA DE IMPLEMENTAÇÃO

### Fase 1 (Semana 1-2): Infraestrutura
- [ ] Configurar Supabase no site Next.js
- [ ] Criar tabela de tokens
- [ ] Implementar sistema de validação de tokens
- [ ] Configurar integração WhatsApp

### Fase 2 (Semana 3-4): Páginas de Cadastro
- [ ] Implementar página de cadastro de morador
- [ ] Implementar página de cadastro de visitante
- [ ] Criar componentes de formulário
- [ ] Implementar validações

### Fase 3 (Semana 5): Aprovação de Visitas
- [ ] Implementar página de aprovação de visitas
- [ ] Integrar com sistema de notificações
- [ ] Testes de fluxo completo

### Fase 4 (Semana 6): Correções e Otimizações
- [ ] Corrigir problemas no app mobile
- [ ] Implementar melhorias de UX
- [ ] Testes de integração
- [ ] Deploy em produção

## 9. CONCLUSÃO

Este planejamento técnico fornece uma solução completa para integrar o sistema de cadastro via site Next.js com o app mobile existente. A implementação resolverá os problemas atuais de fluxo interrompido e proporcionará uma experiência de usuário mais fluida e segura.

A arquitetura proposta mantém a compatibilidade com o sistema existente enquanto adiciona as funcionalidades necessárias para um fluxo de cadastro completo e robusto.