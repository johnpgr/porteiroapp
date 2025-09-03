const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ycamhxzumzkpxuhtugxc.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYW1oeHp1bXprcHh1aHR1Z3hjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTcyMTAzMSwiZXhwIjoyMDcxMjk3MDMxfQ.5abRJDfQeKopRnaoYmFgoS7-0SoldraEMp_VPM7OjdQ';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYW1oeHp1bXprcHh1aHR1Z3hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3MjEwMzEsImV4cCI6MjA3MTI5NzAzMX0.CBgkeAVbxlyJHftmVWSkSPefrbOdMckMvtakRTDpgc8';

const supabaseService = createClient(supabaseUrl, serviceKey);
const supabaseAnon = createClient(supabaseUrl, anonKey);

async function testRLS() {
  console.log('🧪 === TESTE RLS SIMPLES ===\n');
  
  try {
    // Buscar porteiro
    const { data: porteiro, error: porteiroError } = await supabaseService
      .from('profiles')
      .select('id, full_name, building_id')
      .eq('role', 'porteiro')
      .limit(1)
      .single();
    
    if (porteiroError) {
      console.error('❌ Erro ao buscar porteiro:', porteiroError);
      return;
    }
    
    console.log(`📝 Porteiro: ${porteiro.full_name}`);
    console.log(`   ID: ${porteiro.id}`);
    console.log(`   Building: ${porteiro.building_id}\n`);
    
    const testData = {
      porteiro_id: porteiro.id,
      building_id: porteiro.building_id,
      shift_start: new Date().toISOString(),
      status: 'active'
    };
    
    // Teste com service_role
    console.log('1️⃣ Teste com SERVICE_ROLE:');
    const { data: serviceResult, error: serviceError } = await supabaseService
      .from('porteiro_shifts')
      .insert(testData)
      .select()
      .single();
    
    if (serviceError) {
      console.error('❌ Falhou:', serviceError.message);
    } else {
      console.log('✅ Sucesso:', serviceResult.id);
      // Limpar
      await supabaseService.from('porteiro_shifts').delete().eq('id', serviceResult.id);
    }
    
    // Teste com anon
    console.log('\n2️⃣ Teste com ANON:');
    const { data: anonResult, error: anonError } = await supabaseAnon
      .from('porteiro_shifts')
      .insert(testData)
      .select()
      .single();
    
    if (anonError) {
      console.error('❌ Falhou:', anonError.message);
      console.log('   Código:', anonError.code);
    } else {
      console.log('✅ Sucesso:', anonResult.id);
      // Limpar
      await supabaseService.from('porteiro_shifts').delete().eq('id', anonResult.id);
    }
    
    // Verificar permissões
    console.log('\n3️⃣ Verificando permissões:');
    const { data: grants } = await supabaseService
      .from('information_schema.role_table_grants')
      .select('grantee, privilege_type')
      .eq('table_schema', 'public')
      .eq('table_name', 'porteiro_shifts')
      .in('grantee', ['anon', 'authenticated']);
    
    if (grants && grants.length > 0) {
      grants.forEach(g => console.log(`   ${g.grantee}: ${g.privilege_type}`));
    } else {
      console.log('   Nenhuma permissão encontrada');
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

testRLS();