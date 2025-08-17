// Teste direto da função signIn
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = 'https://ckqjqjqjqjqjqjqj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNrcWpxanFqcWpxanFqcWoiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTczNzU1NzI5NCwiZXhwIjoyMDUzMTMzMjk0fQ.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSignIn(email, password) {
  console.log(`\nTestando login para: ${email}`);
  
  try {
    // Hash da senha
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
    console.log('Hash da senha:', passwordHash);
    
    // Buscar usuário
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('password_hash', passwordHash)
      .single();
    
    if (error) {
      console.log('Erro na consulta:', error.message);
      return;
    }
    
    if (!user) {
      console.log('Usuário não encontrado ou senha incorreta');
      return;
    }
    
    console.log('Usuário encontrado:', {
      id: user.id,
      email: user.email,
      user_type: user.user_type,
      name: user.name
    });
    
  } catch (err) {
    console.log('Erro:', err.message);
  }
}

// Testar as três contas
async function runTests() {
  await testSignIn('admin@teste.com', 'admin123');
  await testSignIn('porteiro@teste.com', 'porteiro123');
  await testSignIn('morador@teste.com', 'morador123');
}

runTests();