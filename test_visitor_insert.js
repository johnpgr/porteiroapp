// Script de teste para validar o cadastro de visitantes
// Testa se as políticas RLS e a coluna is_active estão funcionando corretamente

const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = 'https://ycamhxzumzkpxuhtugxc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYW1oeHp1bXprcHh1aHR1Z3hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3MjEwMzEsImV4cCI6MjA3MTI5NzAzMX0.CBgkeAVbxlyJHftmVWSkSPefrbOdMckMvtakRTDpgc8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testVisitorInsert() {
  console.log('🧪 Iniciando teste de cadastro de visitantes...');
  
  try {
    // Dados de teste para um visitante
    const testVisitor = {
      name: 'João Silva Teste',
      document: '12345678901',
      phone: '11999999999',
      photo_url: null,
      is_active: true
    };
    
    console.log('📝 Tentando inserir visitante:', testVisitor);
    
    // Tentar inserir o visitante
    const { data, error } = await supabase
      .from('visitors')
      .insert([testVisitor])
      .select();
    
    if (error) {
      console.error('❌ Erro ao inserir visitante:', error);
      return false;
    }
    
    console.log('✅ Visitante inserido com sucesso:', data);
    
    // Limpar dados de teste
    if (data && data[0]) {
      const { error: deleteError } = await supabase
        .from('visitors')
        .delete()
        .eq('id', data[0].id);
      
      if (deleteError) {
        console.warn('⚠️ Aviso: Não foi possível limpar dados de teste:', deleteError);
      } else {
        console.log('🧹 Dados de teste limpos com sucesso');
      }
    }
    
    return true;
    
  } catch (err) {
    console.error('💥 Erro inesperado:', err);
    return false;
  }
}

async function testTableStructure() {
  console.log('🔍 Verificando estrutura da tabela visitors...');
  
  try {
    // Tentar fazer uma consulta simples para verificar a estrutura
    const { data, error } = await supabase
      .from('visitors')
      .select('id, name, document, phone, photo_url, is_active, created_at, updated_at')
      .limit(1);
    
    if (error) {
      console.error('❌ Erro ao verificar estrutura:', error);
      return false;
    }
    
    console.log('✅ Estrutura da tabela verificada com sucesso');
    console.log('📊 Colunas disponíveis: id, name, document, phone, photo_url, is_active, created_at, updated_at');
    
    return true;
    
  } catch (err) {
    console.error('💥 Erro inesperado ao verificar estrutura:', err);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Executando testes de validação do cadastro de visitantes\n');
  
  // Teste 1: Verificar estrutura da tabela
  const structureTest = await testTableStructure();
  console.log('');
  
  // Teste 2: Testar inserção de visitante
  const insertTest = await testVisitorInsert();
  console.log('');
  
  // Resumo dos testes
  console.log('📋 RESUMO DOS TESTES:');
  console.log(`   Estrutura da tabela: ${structureTest ? '✅ PASSOU' : '❌ FALHOU'}`);
  console.log(`   Inserção de visitante: ${insertTest ? '✅ PASSOU' : '❌ FALHOU'}`);
  
  if (structureTest && insertTest) {
    console.log('\n🎉 Todos os testes passaram! O cadastro de visitantes está funcionando corretamente.');
  } else {
    console.log('\n⚠️ Alguns testes falharam. Verifique as configurações de RLS e estrutura da tabela.');
  }
}

// Executar os testes
runTests().catch(console.error);