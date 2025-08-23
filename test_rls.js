// Script de teste para verificar as políticas RLS
const { createClient } = require('@supabase/supabase-js');

// Configurações do Supabase
const supabaseUrl = 'https://ycamhxzumzkpxuhtugxc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYW1oeHp1bXprcHh1aHR1Z3hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3MjEwMzEsImV4cCI6MjA3MTI5NzAzMX0.CBgkeAVbxlyJHftmVWSkSPefrbOdMckMvtakRTDpgc8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testRLSPolicies() {
  console.log('🧪 Testando políticas RLS...');
  
  try {
    // Teste 1: Tentar ler dados sem autenticação (deve falhar)
    console.log('\n📖 Teste 1: Leitura sem autenticação');
    const { data: readData, error: readError } = await supabase
      .from('communications')
      .select('*')
      .limit(1);
    
    if (readError) {
      console.log('❌ Erro esperado (sem autenticação):', readError.message);
    } else {
      console.log('✅ Leitura permitida:', readData?.length || 0, 'registros');
    }
    
    // Teste 2: Tentar inserir dados sem autenticação (deve falhar)
    console.log('\n✍️ Teste 2: Inserção sem autenticação');
    const { data: insertData, error: insertError } = await supabase
      .from('communications')
      .insert({
        title: 'Teste RLS',
        content: 'Testando políticas RLS',
        type: 'notice',
        priority: 'normal',
        building_id: '123',
        created_by: '456'
      });
    
    if (insertError) {
      console.log('❌ Erro esperado (sem autenticação):', insertError.message);
    } else {
      console.log('⚠️ Inserção permitida (inesperado):', insertData);
    }
    
    // Teste 3: Verificar se as tabelas têm RLS habilitado
    console.log('\n🔒 Teste 3: Verificando status RLS das tabelas');
    const tables = [
      'communications', 'buildings', 'admin_profiles', 'profiles',
      'building_admins', 'apartments', 'apartment_residents'
    ];
    
    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      console.log(`📋 ${table}:`, error ? `❌ ${error.message}` : `✅ ${data?.length || 0} registros`);
    }
    
  } catch (error) {
    console.error('💥 Erro no teste:', error);
  }
}

// Executar o teste
testRLSPolicies();