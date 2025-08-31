# Testes Automatizados - API PorteiroApp

Este diretório contém testes automatizados para validar o funcionamento dos endpoints da API do PorteiroApp.

## 📋 Estrutura dos Testes

### `register-resident.test.js`
Testes básicos para o endpoint `/api/register-resident`:
- ✅ Registro com dados válidos
- ✅ Validação de campos obrigatórios
- ✅ Validação de dados inválidos
- ✅ Estrutura da resposta
- ✅ Teste de carga básica

### `register-resident-advanced.test.js`
Testes avançados para cenários complexos:
- 🔍 Validação de tipos de dados
- 🌐 Caracteres especiais e encoding
- 📏 Limites de tamanho de dados
- ⚡ Teste de concorrência
- 🔒 Validação de headers HTTP

### `database-persistence.test.js`
Testes específicos de persistência no banco de dados:
- 💾 Validação de persistência real no Supabase
- 🔄 Consistência entre API e banco de dados
- 🏃‍♂️ Teste de inserções simultâneas (concorrência)
- 🔙 Validação de rollback em caso de erro
- 🔍 Verificação de integridade dos dados
- 🧹 Limpeza automática de dados de teste

## 🚀 Como Executar os Testes

### Pré-requisitos
1. **API rodando**: Certifique-se de que a API está rodando em `http://localhost:3001`
2. **Node.js**: Versão 16 ou superior
3. **Dependências**: Instale as dependências necessárias

### Instalação das Dependências
```bash
cd tests
npm install
```

Ou instale manualmente:
```bash
npm install axios @supabase/supabase-js
```

### Executar Testes Básicos
```bash
# Executar todos os testes básicos
npm test

# Ou executar diretamente
node register-resident.test.js
```

### Executar Testes Avançados
```bash
# Executar testes avançados
node register-resident-advanced.test.js
```

### Executar Testes de Persistência
```bash
# Executar testes de persistência no banco de dados
npm run test:persistence

# Ou executar diretamente
node database-persistence.test.js
```

### Executar Todos os Testes
```bash
# Executar todos os testes em sequência
npm run test:all
```

## 📊 Estrutura do Endpoint Testado

### `/api/register-resident`

**Método**: `POST`

**Campos Obrigatórios**:
- `name` (string): Nome completo do residente
- `phone` (string): Número de telefone
- `building` (string): Nome do prédio
- `apartment` (string): Número do apartamento

**Campos Opcionais**:
- `building_id` (string): ID do prédio
- `temporary_password` (string): Senha temporária

**Resposta de Sucesso (200)**:
```json
{
  "success": true,
  "message": "Cadastro iniciado com sucesso! Verifique seu WhatsApp para as credenciais de acesso.",
  "data": {
    "profile_id": "uuid-gerado",
    "email": "telefone@temp.jamesconcierge.com",
    "building_name": "Nome do Prédio",
    "apartment_number": "Número do Apartamento"
  }
}
```

**Resposta de Erro (400)**:
```json
{
  "success": false,
  "error": "Campos obrigatórios: name, phone, building, apartment"
}
```

## 🔧 Configuração

### Variáveis de Ambiente
Os testes utilizam as seguintes variáveis de ambiente (com valores padrão):

```bash
# URL da API (padrão: http://localhost:3001)
API_BASE_URL=http://localhost:3001

# Configuração do Supabase
SUPABASE_URL=https://ycamhxzumzkpxuhtugxc.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-chave-aqui
```

### Personalização
Para personalizar os testes, edite as constantes no início dos arquivos:

```javascript
// Alterar URL da API
const API_BASE_URL = 'http://localhost:3001';

// Dados de teste personalizados
const validTestData = {
  name: 'Seu Nome Aqui',
  phone: '91981941219', // Número de teste seguro
  building: 'Seu Prédio',
  apartment: '101'
};
```

## 📈 Interpretando os Resultados

### ✅ Teste Passou
- Todos os critérios foram atendidos
- API respondeu conforme esperado
- Dados foram validados corretamente

### ❌ Teste Falhou
- Algum critério não foi atendido
- Verifique os logs para detalhes do erro
- Possíveis causas:
  - API não está rodando
  - Endpoint retornou status inesperado
  - Estrutura da resposta incorreta

### ⚠️ Aviso
- Comportamento inesperado mas não crítico
- API funcionou mas com diferenças menores
- Revisar se é comportamento desejado

## 🐛 Solução de Problemas

### API não está rodando
```bash
# Verificar se a API está rodando
curl http://localhost:3001/health

# Ou no PowerShell
Invoke-WebRequest -Uri "http://localhost:3001/health"
```

### Erro de dependências
```bash
# Reinstalar dependências
rm -rf node_modules package-lock.json
npm install
```

### Timeout nos testes
- Aumentar o timeout nos arquivos de teste
- Verificar se a API está respondendo lentamente
- Verificar conexão com o banco de dados

### Erro de conexão com Supabase
- Verificar as credenciais do Supabase
- Confirmar se as variáveis de ambiente estão corretas
- Testar conexão manualmente

## 📝 Adicionando Novos Testes

Para adicionar novos testes:

1. **Criar nova função de teste**:
```javascript
async function testNovaFuncionalidade() {
  console.log('\n🧪 Teste: Nova Funcionalidade');
  
  // Seu código de teste aqui
  const result = await makeRequest('/api/endpoint', testData);
  
  // Validações
  if (result.status !== 200) {
    throw new Error('Teste falhou');
  }
  
  console.log('🎉 Teste PASSOU: Nova Funcionalidade');
}
```

2. **Adicionar à função principal**:
```javascript
async function runAllTests() {
  // ... outros testes
  await testNovaFuncionalidade();
}
```

3. **Exportar a função**:
```javascript
module.exports = {
  // ... outras funções
  testNovaFuncionalidade
};
```

## 📞 Suporte

Para dúvidas ou problemas com os testes:
1. Verifique os logs detalhados dos testes
2. Confirme se a API está funcionando manualmente
3. Revise a documentação da API
4. Consulte a equipe de desenvolvimento

---

**Última atualização**: Janeiro 2025
**Versão dos testes**: 1.0.0