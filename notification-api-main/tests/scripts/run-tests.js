#!/usr/bin/env node

/**
 * Script automatizado para executar todos os testes do sistema WebRTC
 * James Avisa - Sistema de Videoporteiro
 */

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');

const execAsync = util.promisify(exec);

// Configurações
const config = {
  testTimeout: 30000,
  serverStartTimeout: 10000,
  colors: {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
  }
};

// Utilitários de log
function log(message, color = 'reset') {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${config.colors[color]}[${timestamp}] ${message}${config.colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function logHeader(message) {
  const separator = '='.repeat(60);
  console.log(`\n${config.colors.cyan}${separator}`);
  console.log(`${config.colors.bright}${config.colors.cyan}${message}`);
  console.log(`${separator}${config.colors.reset}\n`);
}

// Verificar se o servidor está rodando
function checkServerStatus() {
  return new Promise((resolve) => {
    const http = require('http');
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/webrtc/health',
      method: 'GET',
      timeout: 5000
    }, (res) => {
      resolve(res.statusCode === 200);
    });

    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    
    req.end();
  });
}

// Iniciar servidor se necessário
function startServer() {
  return new Promise((resolve, reject) => {
    logInfo('Iniciando servidor de desenvolvimento...');
    
    const server = spawn('npm', ['run', 'dev'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true
    });

    let serverReady = false;
    const timeout = setTimeout(() => {
      if (!serverReady) {
        server.kill();
        reject(new Error('Timeout ao iniciar servidor'));
      }
    }, config.serverStartTimeout);

    server.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Server running') || output.includes('localhost:3000')) {
        serverReady = true;
        clearTimeout(timeout);
        logSuccess('Servidor iniciado com sucesso');
        resolve(server);
      }
    });

    server.stderr.on('data', (data) => {
      const error = data.toString();
      if (error.includes('EADDRINUSE')) {
        clearTimeout(timeout);
        logWarning('Servidor já está rodando');
        resolve(null);
      }
    });

    server.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

// Executar testes Jest
function runJestTests(pattern = '') {
  return new Promise((resolve, reject) => {
    logInfo(`Executando testes Jest${pattern ? ` (padrão: ${pattern})` : ''}...`);
    
    const jestArgs = ['test'];
    if (pattern) {
      jestArgs.push(pattern);
    }
    jestArgs.push('--verbose', '--coverage');

    const jest = spawn('npm', jestArgs, {
      stdio: 'inherit',
      shell: true
    });

    jest.on('close', (code) => {
      if (code === 0) {
        logSuccess('Testes Jest concluídos com sucesso');
        resolve();
      } else {
        logError(`Testes Jest falharam (código: ${code})`);
        reject(new Error(`Jest failed with code ${code}`));
      }
    });

    jest.on('error', (error) => {
      logError(`Erro ao executar Jest: ${error.message}`);
      reject(error);
    });
  });
}

// Executar testes de API
function runAPITests() {
  logHeader('TESTES DE API REST');
  return runJestTests('api');
}

// Executar testes de WebSocket
function runWebSocketTests() {
  logHeader('TESTES DE WEBSOCKET');
  return runJestTests('websocket');
}

// Executar testes de integração
function runIntegrationTests() {
  logHeader('TESTES DE INTEGRAÇÃO');
  return runJestTests('integration');
}

// Executar testes de autenticação
function runAuthTests() {
  logHeader('TESTES DE AUTENTICAÇÃO');
  return runJestTests('auth');
}

// Executar todos os testes
function runAllTests() {
  logHeader('EXECUTANDO TODOS OS TESTES');
  return runJestTests();
}

// Verificar dependências
function checkDependencies() {
  logHeader('VERIFICANDO DEPENDÊNCIAS');
  
  const requiredDeps = [
    'jest',
    'supertest',
    'socket.io-client',
    '@types/jest'
  ];

  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const installedDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  };

  let allDepsInstalled = true;

  requiredDeps.forEach(dep => {
    if (installedDeps[dep]) {
      logSuccess(`${dep} está instalado (${installedDeps[dep]})`);
    } else {
      logError(`${dep} não está instalado`);
      allDepsInstalled = false;
    }
  });

  return allDepsInstalled;
}

// Gerar relatório de cobertura
function generateCoverageReport() {
  logHeader('GERANDO RELATÓRIO DE COBERTURA');
  
  const coverageDir = path.join(process.cwd(), 'coverage');
  
  if (fs.existsSync(coverageDir)) {
    const lcovPath = path.join(coverageDir, 'lcov-report', 'index.html');
    
    if (fs.existsSync(lcovPath)) {
      logSuccess(`Relatório de cobertura disponível em: ${lcovPath}`);
      logInfo('Para visualizar, abra o arquivo no navegador');
    } else {
      logWarning('Relatório HTML de cobertura não encontrado');
    }
  } else {
    logWarning('Diretório de cobertura não encontrado');
  }
}

// Executar testes de performance
function runPerformanceTests() {
  logHeader('TESTES DE PERFORMANCE');
  
  return new Promise(async (resolve) => {
    try {
      logInfo('Testando tempo de resposta das APIs...');
      
      const startTime = Date.now();
      const response = await fetch('http://localhost:3000/api/webrtc/health');
      const endTime = Date.now();
      
      const responseTime = endTime - startTime;
      
      if (response.ok) {
        if (responseTime < 100) {
          logSuccess(`API de saúde respondeu em ${responseTime}ms (excelente)`);
        } else if (responseTime < 500) {
          logWarning(`API de saúde respondeu em ${responseTime}ms (aceitável)`);
        } else {
          logError(`API de saúde respondeu em ${responseTime}ms (lento)`);
        }
      } else {
        logError('API de saúde não está respondendo');
      }
      
      resolve();
    } catch (error) {
      logError(`Erro nos testes de performance: ${error.message}`);
      resolve();
    }
  });
}

// Validar configuração do ambiente
function validateEnvironment() {
  logHeader('VALIDANDO AMBIENTE');
  
  // Verificar Node.js
  const nodeVersion = process.version;
  logInfo(`Node.js: ${nodeVersion}`);
  
  // Verificar npm
  try {
    const { stdout } = require('child_process').execSync('npm --version', { encoding: 'utf8' });
    logInfo(`npm: ${stdout.trim()}`);
  } catch (error) {
    logError('npm não encontrado');
  }
  
  // Verificar variáveis de ambiente
  const requiredEnvVars = ['JWT_SECRET', 'SUPABASE_URL', 'SUPABASE_ANON_KEY'];
  
  requiredEnvVars.forEach(envVar => {
    if (process.env[envVar]) {
      logSuccess(`${envVar} está configurado`);
    } else {
      logWarning(`${envVar} não está configurado`);
    }
  });
}

// Função principal
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'all';
  
  console.log(`${config.colors.magenta}${config.colors.bright}`);
  console.log('🚀 James Avisa - Sistema de Testes WebRTC');
  console.log('==========================================');
  console.log(`${config.colors.reset}\n`);
  
  try {
    // Validar ambiente
    validateEnvironment();
    
    // Verificar dependências
    if (!checkDependencies()) {
      logError('Dependências faltando. Execute: npm install');
      process.exit(1);
    }
    
    // Verificar se o servidor está rodando
    let serverProcess = null;
    const isServerRunning = await checkServerStatus();
    
    if (!isServerRunning) {
      try {
        serverProcess = await startServer();
        // Aguardar um pouco para o servidor estabilizar
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (error) {
        logError(`Erro ao iniciar servidor: ${error.message}`);
        process.exit(1);
      }
    } else {
      logSuccess('Servidor já está rodando');
    }
    
    // Executar testes baseado no comando
    switch (command) {
      case 'api':
        await runAPITests();
        break;
      case 'websocket':
        await runWebSocketTests();
        break;
      case 'integration':
        await runIntegrationTests();
        break;
      case 'auth':
        await runAuthTests();
        break;
      case 'performance':
        await runPerformanceTests();
        break;
      case 'all':
      default:
        await runAllTests();
        await runPerformanceTests();
        break;
    }
    
    // Gerar relatório de cobertura
    generateCoverageReport();
    
    logHeader('TESTES CONCLUÍDOS');
    logSuccess('Todos os testes foram executados!');
    
    // Parar servidor se foi iniciado por este script
    if (serverProcess) {
      logInfo('Parando servidor...');
      serverProcess.kill();
    }
    
  } catch (error) {
    logError(`Erro durante execução dos testes: ${error.message}`);
    process.exit(1);
  }
}

// Tratar sinais de interrupção
process.on('SIGINT', () => {
  logWarning('\nTestes interrompidos pelo usuário');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logWarning('\nTestes terminados');
  process.exit(0);
});

// Executar se chamado diretamente
if (require.main === module) {
  main().catch(error => {
    logError(`Erro fatal: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  runAPITests,
  runWebSocketTests,
  runIntegrationTests,
  runAuthTests,
  runAllTests,
  checkServerStatus,
  validateEnvironment
};