// Teste simples de conexão com Supabase
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ycamhxzumzkpxuhtugxc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYW1oeHp1bXprcHh1aHR1Z3hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3MjEwMzEsImV4cCI6MjA3MTI5NzAzMX0.CBgkeAVbxlyJHftmVWSkSPefrbOdMckMvtakRTDpgc8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSupabaseConnection() {
  console.log('🔍 Testando conexão com Supabase...');
  
  try {
    // Teste 1: Verificar se consegue conectar
    const { data: testData, error: testError } = await supabase
      .from('profiles')
      .select('count')
      .limit(1);
    
    if (testError) {
      console.error('❌ Erro na conexão:', testError);
      return false;
    }
    
    console.log('✅ Conexão com Supabase OK');
    
    // Teste 2: Verificar tabelas necessárias
    const tables = ['visitors', 'visitor_logs', 'apartments', 'apartment_residents'];
    
    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select('count')
        .limit(1);
      
      if (error) {
        console.error(`❌ Erro ao acessar tabela ${table}:`, error);
      } else {
        console.log(`✅ Tabela ${table} acessível`);
      }
    }
    
    // Teste 3: Verificar autenticação
    const { data: { user } } = await supabase.auth.getUser();
    console.log('👤 Usuário atual:', user ? user.id : 'Não autenticado');
    
    return true;
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
    return false;
  }
}

// Executar teste
testSupabaseConnection();

export default testSupabaseConnection;