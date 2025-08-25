# Script de Teste - Sistema de Votação e Notificações

Este script JavaScript verifica todos os requisitos necessários para implementar o sistema de votação e notificações, incluindo tratamento de erros específicos e validação de políticas RLS.

## 📋 O que o Script Testa

### 1. **Estrutura de Tabelas**
- ✅ Verifica se a tabela `notification_audit_log` possui o campo `old_status`
- ✅ Verifica se a tabela `poll_votes` possui o campo `poll_option_id`
- ✅ Valida campos obrigatórios em `visitor_logs` para notificações

### 2. **Sistema de Votação**
- ✅ Testa unicidade de voto por morador em enquetes
- ✅ Valida constraint de voto único
- ✅ Verifica políticas RLS para `poll_votes`
- ✅ Testa cenários de múltiplos votos (deve falhar)

### 3. **Sistema de Notificações**
- ✅ Verifica campo `resident_response_by` ou alternativas
- ✅ Testa criação automática de audit logs
- ✅ Valida atualização de status de notificações

### 4. **Tratamento de Erros Específicos**
- ✅ **Erro 42703**: "column does not exist" (campo não existe)
- ✅ **Erro 42501**: "new row violates row-level security policy"
- ✅ Validação de campos obrigatórios
- ✅ Testes de segurança RLS

## 🚀 Como Executar

### Pré-requisitos

1. **Node.js** instalado (versão 16 ou superior)
2. **Projeto Supabase** configurado
3. **Credenciais do Supabase** (URL, ANON_KEY, SERVICE_KEY)

### Passo 1: Configurar Ambiente

```bash
# 1. Copiar arquivo de configuração
cp .env.test.example .env.test

# 2. Editar .env.test com suas credenciais do Supabase
# - SUPABASE_URL: URL do seu projeto
# - SUPABASE_ANON_KEY: Chave anônima (Settings > API)
# - SUPABASE_SERVICE_KEY: Chave de serviço (Settings > API)
```

### Passo 2: Instalar Dependências

```bash
# Instalar dependências específicas para o teste
npm install @supabase/supabase-js@^2.39.0 dotenv@^16.3.1

# OU usando o package.json do teste
npm install --prefix . -f test-package.json
```

### Passo 3: Executar o Script

```bash
# Executar teste básico
node test-voting-system.js

# Executar com debug detalhado
DEBUG=* node test-voting-system.js

# Executar com arquivo de ambiente específico
node -r dotenv/config test-voting-system.js dotenv_config_path=.env.test
```

## 📊 Interpretando os Resultados

### ✅ **Teste Passou**
```
✓ Estrutura notification_audit_log - PASSOU
✓ Votação única por usuário - PASSOU
```

### ❌ **Teste Falhou**
```
✗ Campo resident_response_by - FALHOU: Campo 'resident_response_by' não encontrado
```

### ⚠️ **Avisos**
```
⚠ Campo resident_response_by não encontrado, mas pode usar authorized_by
```

### 📈 **Relatório Final**
```
=== RELATÓRIO FINAL ===

Resumo dos Testes:
Total: 10
Passa: 8
Falhou: 2

Erros Encontrados:
1. Estrutura poll_votes: Campo 'poll_option_id' não encontrado
2. Votação única por usuário: Constraint de unicidade não configurada

Taxa de Sucesso: 80.0%
```

## 🔧 Solucionando Problemas Comuns

### Erro: "Configure as variáveis de ambiente"
**Solução**: Verifique se o arquivo `.env.test` existe e contém as credenciais corretas.

### Erro: "Campo 'old_status' não encontrado"
**Solução**: Execute a migração que adiciona o campo:
```sql
ALTER TABLE notification_audit_log ADD COLUMN old_status VARCHAR;
```

### Erro: "Campo 'poll_option_id' não encontrado"
**Solução**: Execute a migração que adiciona o campo:
```sql
ALTER TABLE poll_votes ADD COLUMN poll_option_id UUID NOT NULL;
```

### Erro: "new row violates row-level security policy"
**Solução**: Verifique as políticas RLS:
```sql
-- Verificar políticas existentes
SELECT * FROM pg_policies WHERE tablename = 'poll_votes';

-- Adicionar política se necessário
CREATE POLICY "Users can vote on polls" ON poll_votes
  FOR INSERT TO authenticated
  USING (auth.uid() = user_id);
```

## 🛠️ Estrutura do Script

### Funções Principais

- `testNotificationAuditLogStructure()` - Verifica estrutura da tabela de audit
- `testPollVotesStructure()` - Verifica estrutura da tabela de votos
- `testResidentResponseByField()` - Verifica campo de resposta do morador
- `testUniqueVoting()` - Testa unicidade de votos
- `testPollVotesRLS()` - Testa políticas RLS
- `testSpecificErrorHandling()` - Testa erros específicos (42703, 42501)
- `cleanupTestData()` - Limpa dados de teste

### Dados de Teste Criados

O script cria temporariamente:
- ✨ Usuário de teste
- 🏢 Prédio de teste
- 🏠 Apartamento de teste
- 📊 Enquete com opções
- 📝 Logs de visitante
- 🗳️ Votos de teste

**Importante**: Todos os dados são automaticamente removidos após os testes.

## 🔒 Segurança

- ⚠️ **Nunca** commite arquivos `.env` com credenciais reais
- 🔑 Use a `SERVICE_KEY` apenas em ambiente de desenvolvimento/teste
- 🛡️ O script testa políticas RLS mas não as modifica
- 🧹 Limpeza automática previne acúmulo de dados de teste

## 📝 Logs e Debug

O script produz logs coloridos para facilitar a identificação:
- 🔵 **Azul**: Informações gerais
- 🟢 **Verde**: Testes que passaram
- 🔴 **Vermelho**: Testes que falharam
- 🟡 **Amarelo**: Avisos
- 🟣 **Magenta**: Seções e resumos

## 🤝 Contribuindo

Para adicionar novos testes:

1. Crie uma nova função de teste
2. Adicione-a à função `main()`
3. Use `runTest()` para execução padronizada
4. Inclua limpeza de dados se necessário

```javascript
async function testNovaFuncionalidade() {
  // Seu código de teste aqui
  log.success('Teste passou!');
}

// Na função main()
await runTest('Nova Funcionalidade', testNovaFuncionalidade);
```

## 📞 Suporte

Se encontrar problemas:

1. Verifique se todas as migrações foram aplicadas
2. Confirme as credenciais do Supabase
3. Execute com `DEBUG=*` para logs detalhados
4. Verifique as políticas RLS no painel do Supabase

---

**Desenvolvido para o Sistema Porteiro** 🏢

*Este script garante que o sistema de votação e notificações funcione corretamente antes da implementação em produção.*