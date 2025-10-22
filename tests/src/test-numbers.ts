/**
 * Arquivo dedicado para números de teste seguros
 *
 * IMPORTANTE: Este arquivo contém apenas números de teste aprovados.
 * NUNCA adicione números reais ou desconhecidos para evitar riscos de banimento.
 *
 * Todos os testes devem usar exclusivamente os números listados aqui.
 */

// Número de teste seguro aprovado para uso em todos os testes
const TEST_PHONE_NUMBER = '91981941219';

// Função para obter o número de teste
export function getTestPhoneNumber(): string {
  return TEST_PHONE_NUMBER;
}

// Função para validar se um número é seguro para teste
export function isTestPhoneNumber(phoneNumber: string): boolean {
  return phoneNumber === TEST_PHONE_NUMBER;
}

// Exportar constante
export { TEST_PHONE_NUMBER };

// Log de segurança
console.log('📱 Número de teste carregado:', TEST_PHONE_NUMBER);
console.log('⚠️  ATENÇÃO: Use apenas este número para testes!');
