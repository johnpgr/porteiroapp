// Teste específico para o processo de cadastro de visitante
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ycamhxzumzkpxuhtugxc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYW1oeHp1bXprcHh1aHR1Z3hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3MjEwMzEsImV4cCI6MjA3MTI5NzAzMX0.CBgkeAVbxlyJHftmVWSkSPefrbOdMckMvtakRTDpgc8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testVisitorRegistration() {
  console.log('🧪 Testando processo de cadastro de visitante...');
  
  try {
    // Simular dados de teste
    const testData = {
      name: 'João Teste',
      cpf: '12345678901',
      phone: '11999999999',
      apartment: '101',
      building: 'Edifício Teste'
    };
    
    console.log('📋 Dados de teste:', testData);
    
    // Passo 1: Verificar se consegue buscar apartamentos
    console.log('\n🔍 Passo 1: Buscando apartamentos...');
    const { data: apartments, error: apartmentsError } = await supabase
      .from('apartments')
      .select('*')
      .limit(5);
    
    if (apartmentsError) {
      console.error('❌ Erro ao buscar apartamentos:', apartmentsError);
      return false;
    }
    
    console.log('✅ Apartamentos encontrados:', apartments?.length || 0);
    if (apartments && apartments.length > 0) {
      console.log('📍 Primeiro apartamento:', apartments[0]);
    }
    
    // Passo 2: Verificar se consegue buscar apartment_residents
    console.log('\n🔍 Passo 2: Buscando moradores...');
    const { data: residents, error: residentsError } = await supabase
      .from('apartment_residents')
      .select('*')
      .limit(5);
    
    if (residentsError) {
      console.error('❌ Erro ao buscar moradores:', residentsError);
      return false;
    }
    
    console.log('✅ Moradores encontrados:', residents?.length || 0);
    if (residents && residents.length > 0) {
      console.log('👤 Primeiro morador:', residents[0]);
    }
    
    // Passo 3: Tentar inserir um visitante de teste
    console.log('\n🔍 Passo 3: Tentando inserir visitante...');
    const visitorData = {
      name: testData.name,
      document: testData.cpf,
      phone: testData.phone,
      is_active: true
    };
    
    const { data: insertedVisitor, error: visitorError } = await supabase
      .from('visitors')
      .insert([visitorData])
      .select()
      .single();
    
    if (visitorError) {
      console.error('❌ Erro ao inserir visitante:', visitorError);
      console.error('📋 Dados que tentamos inserir:', visitorData);
      return false;
    }
    
    console.log('✅ Visitante inserido com sucesso:', insertedVisitor);
    
    // Passo 4: Tentar inserir um log de visitante
    console.log('\n🔍 Passo 4: Tentando inserir log de visitante...');
    
    // Usar o primeiro apartamento encontrado para teste
    const testApartmentId = apartments && apartments.length > 0 ? apartments[0].id : null;
    
    if (!testApartmentId) {
      console.error('❌ Nenhum apartamento disponível para teste');
      return false;
    }
    
    const logData = {
      visitor_id: insertedVisitor.id,
      apartment_id: testApartmentId,
      building_id: apartments[0].building_id,
      visit_session_id: crypto.randomUUID(),
      tipo_log: 'IN',
      status: 'approved',
      purpose: 'Visita social'
    };
    
    const { data: insertedLog, error: logError } = await supabase
      .from('visitor_logs')
      .insert([logData])
      .select()
      .single();
    
    if (logError) {
      console.error('❌ Erro ao inserir log de visitante:', logError);
      console.error('📋 Dados que tentamos inserir:', logData);
      return false;
    }
    
    console.log('✅ Log de visitante inserido com sucesso:', insertedLog);
    
    // Passo 5: Limpar dados de teste
    console.log('\n🧹 Limpando dados de teste...');
    
    // Deletar log primeiro (devido à foreign key)
    await supabase.from('visitor_logs').delete().eq('id', insertedLog.id);
    // Depois deletar visitante
    await supabase.from('visitors').delete().eq('id', insertedVisitor.id);
    
    console.log('✅ Dados de teste removidos');
    
    console.log('\n🎉 Teste de cadastro de visitante concluído com SUCESSO!');
    return true;
    
  } catch (error) {
    console.error('💥 Erro geral no teste:', error);
    return false;
  }
}

// Executar teste
testVisitorRegistration().then(success => {
  if (success) {
    console.log('\n✅ RESULTADO: Processo de cadastro está funcionando corretamente');
  } else {
    console.log('\n❌ RESULTADO: Há problemas no processo de cadastro');
  }
}).catch(error => {
  console.error('💥 Erro ao executar teste:', error);
});

export default testVisitorRegistration;