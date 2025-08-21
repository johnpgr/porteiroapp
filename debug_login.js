// Script de debug para testar login
const crypto = require('crypto');

// Simular hash das senhas de teste
const testPasswords = {
  admin123: crypto.createHash('sha256').update('admin123').digest('hex'),
  porteiro123: crypto.createHash('sha256').update('porteiro123').digest('hex'),
  morador123: crypto.createHash('sha256').update('morador123').digest('hex'),
};

console.log('Hashes das senhas de teste:');
console.log('admin123:', testPasswords.admin123);
console.log('porteiro123:', testPasswords.porteiro123);
console.log('morador123:', testPasswords.morador123);

// Testar se o hash está sendo gerado corretamente
const testHash = crypto.createHash('sha256').update('admin123').digest('hex');
console.log('\nTeste de hash para admin123:', testHash);
console.log('Deve ser igual ao hash armazenado no banco de dados.');
