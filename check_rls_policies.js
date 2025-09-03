const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ycamhxzumzkpxuhtugxc.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYW1oeHp1bXprcHh1aHR1Z3hjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTcyMTAzMSwiZXhwIjoyMDcxMjk3MDMxfQ.5abRJDfQeKopRnaoYmFgoS7-0SoldraEMp_VPM7OjdQ';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkRLSPolicies() {
  console.log('🔍 === VERIFICANDO POLÍTICAS RLS ===\n');
  
  try {
    // Verificar políticas da tabela porteiro_shifts
    const { data: policies, error } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('tablename', 'porteiro_shifts');
    
    if (error) {
      console.error('❌ Erro ao buscar políticas:', error);
      return;
    }
    
    console.log('📋 Políticas RLS para porteiro_shifts:');
    policies.forEach((policy, index) => {
      console.log(`\n${index + 1}. ${policy.policyname}`);
      console.log(`   Comando: ${policy.cmd}`);
      console.log(`   Roles: ${policy.roles}`);
      console.log(`   Qual: ${policy.qual}`);
      console.log(`   With Check: ${policy.with_check}`);
    });
    
    // Verificar permissões da tabela
    console.log('\n🔐 === VERIFICANDO PERMISSÕES DA TABELA ===\n');
    
    const { data: permissions, error: permError } = await supabase
      .rpc('check_table_permissions', { table_name: 'porteiro_shifts' });
    
    if (permError) {
      console.log('ℹ️ Função check_table_permissions não disponível, verificando manualmente...');
      
      // Verificar permissões manualmente
      const { data: grants, error: grantError } = await supabase
        .from('information_schema.role_table_grants')
        .select('grantee, table_name, privilege_type')
        .eq('table_schema', 'public')
        .eq('table_name', 'porteiro_shifts')
        .in('grantee', ['anon', 'authenticated']);
      
      if (grantError) {
        console.error('❌ Erro ao verificar permissões:', grantError);
      } else {
        console.log('📊 Permissões da tabela porteiro_shifts:');
        grants.forEach(grant => {
          console.log(`   ${grant.grantee}: ${grant.privilege_type}`);
        });
      }
    } else {
      console.log('📊 Permissões:', permissions);
    }
    
    // Testar inserção com role authenticated
    console.log('\n🧪 === TESTANDO INSERÇÃO COM ROLE AUTHENTICATED ===\n');
    
    const supabaseAuth = createClient(supabaseUrl, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYW1oeHp1bXprcHh1aHR1Z3hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3MjEwMzEsImV4cCI6MjA3MTI5NzAzMX0.CBgkeAVbxlyJHftmVWSkSPefrbOdMckMvtakRTDpgc8');
    
    // Buscar um porteiro para teste
    const { data: porteiro, error: porteiroError } = await supabase
      .from('profiles')
      .select('id, full_name, building_id')
      .eq('role', 'porteiro')
      .limit(1)
      .single();
    
    if (porteiroError) {
      console.error('❌ Erro ao buscar porteiro:', porteiroError);
      return;
    }
    
    console.log(`📝 Testando inserção para porteiro: ${porteiro.full_name} (${porteiro.id})`);
    
    const testShift = {
      porteiro_id: porteiro.id,
      building_id: porteiro.building_id,
      shift_start: new Date().toISOString(),
      status: 'active'
    };
    
    const { data: insertResult, error: insertError } = await supabaseAuth
      .from('porteiro_shifts')
      .insert(testShift)
      .select()
      .single();
    
    if (insertError) {
      console.error('❌ Erro na inserção com role anon:', insertError.message);
    } else {
      console.log('✅ Inserção bem-sucedida com role anon:', insertResult.id);
      
      // Limpar o teste
      await supabase
        .from('porteiro_shifts')
        .delete()
        .eq('id', insertResult.id);
      
      console.log('🧹 Registro de teste removido');
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

checkRLSPolicies().then(() => {
  console.log('\n✅ Verificação finalizada');
});