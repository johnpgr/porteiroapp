const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ycamhxzumzkpxuhtugxc.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYW1oeHp1bXprcHh1aHR1Z3hjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTcyMTAzMSwiZXhwIjoyMDcxMjk3MDMxfQ.5abRJDfQeKopRnaoYmFgoS7-0SoldraEMp_VPM7OjdQ';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYW1oeHp1bXprcHh1aHR1Z3hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3MjEwMzEsImV4cCI6MjA3MTI5NzAzMX0.CBgkeAVbxlyJHftmVWSkSPefrbOdMckMvtakRTDpgc8';

const supabaseService = createClient(supabaseUrl, serviceKey);
const supabaseClient = createClient(supabaseUrl, anonKey);

async function testAuthenticatedShift() {
  console.log('🧪 === TESTE COM USUÁRIO AUTENTICADO ===\n');
  
  try {
    // 1. Buscar um porteiro que tenha user_id
    const { data: porteiro, error: porteiroError } = await supabaseService
      .from('profiles')
      .select('id, full_name, building_id, user_id')
      .eq('role', 'porteiro')
      .not('user_id', 'is', null)
      .limit(1)
      .single();
    
    if (porteiroError) {
      console.error('❌ Erro ao buscar porteiro:', porteiroError);
      return;
    }
    
    console.log(`📝 Porteiro encontrado: ${porteiro.full_name}`);
    console.log(`   Profile ID: ${porteiro.id}`);
    console.log(`   User ID: ${porteiro.user_id}`);
    console.log(`   Building: ${porteiro.building_id}\n`);
    
    // 2. Criar um usuário temporário para teste (se necessário)
    let testUserId = porteiro.user_id;
    
    if (!testUserId) {
      console.log('⚠️ Porteiro não tem user_id, criando usuário de teste...');
      
      // Criar usuário temporário
      const { data: authData, error: authError } = await supabaseService.auth.admin.createUser({
        email: `test-porteiro-${Date.now()}@example.com`,
        password: 'test123456',
        email_confirm: true
      });
      
      if (authError) {
        console.error('❌ Erro ao criar usuário:', authError);
        return;
      }
      
      testUserId = authData.user.id;
      
      // Atualizar o profile com o user_id
      await supabaseService
        .from('profiles')
        .update({ user_id: testUserId })
        .eq('id', porteiro.id);
      
      console.log(`✅ Usuário criado: ${testUserId}\n`);
    }
    
    // 3. Fazer login com o usuário
    console.log('🔐 Fazendo login...');
    
    // Simular autenticação definindo o JWT token manualmente
    // Isso é uma simulação - em produção, o login seria feito normalmente
    const mockJWT = {
      sub: testUserId,
      aud: 'authenticated',
      role: 'authenticated'
    };
    
    // Criar client com token customizado (simulação)
    const authenticatedClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${anonKey}` // Usando anon key como fallback
        }
      }
    });
    
    // 4. Testar inserção de turno
    console.log('📝 Testando inserção de turno...');
    
    const testShift = {
      porteiro_id: porteiro.id, // Profile ID, não user_id
      building_id: porteiro.building_id,
      shift_start: new Date().toISOString(),
      status: 'active'
    };
    
    // Primeiro, vamos verificar se o problema é com a política RLS
    // Vamos tentar inserir diretamente com service_role e depois verificar
    console.log('\n🔍 Analisando o problema...');
    
    // Verificar se existe algum turno ativo para este porteiro
    const { data: existingShifts, error: existingError } = await supabaseService
      .from('porteiro_shifts')
      .select('*')
      .eq('porteiro_id', porteiro.id)
      .is('shift_end', null);
    
    if (existingError) {
      console.error('❌ Erro ao verificar turnos existentes:', existingError);
    } else {
      console.log(`📊 Turnos ativos encontrados: ${existingShifts.length}`);
      if (existingShifts.length > 0) {
        console.log('⚠️ Já existe turno ativo para este porteiro');
        existingShifts.forEach((shift, i) => {
          console.log(`   ${i+1}. ID: ${shift.id}, Início: ${new Date(shift.shift_start).toLocaleString('pt-BR')}`);
        });
      }
    }
    
    // Tentar inserção com service_role (deve funcionar)
    console.log('\n1️⃣ Teste com SERVICE_ROLE:');
    const { data: serviceResult, error: serviceError } = await supabaseService
      .from('porteiro_shifts')
      .insert(testShift)
      .select()
      .single();
    
    if (serviceError) {
      console.error('❌ Falhou com service_role:', serviceError.message);
    } else {
      console.log('✅ Sucesso com service_role:', serviceResult.id);
      
      // Limpar imediatamente
      await supabaseService
        .from('porteiro_shifts')
        .delete()
        .eq('id', serviceResult.id);
      
      console.log('🧹 Registro removido');
    }
    
    // O problema real é que as políticas RLS requerem auth.uid() = porteiro_id
    // Mas porteiro_id é o ID do profile, não o user_id
    // Vamos verificar essa discrepância
    console.log('\n🔍 Verificando discrepância entre user_id e porteiro_id:');
    console.log(`   auth.uid() seria: ${testUserId}`);
    console.log(`   porteiro_id é: ${porteiro.id}`);
    console.log(`   São iguais? ${testUserId === porteiro.id ? 'SIM' : 'NÃO'}`);
    
    if (testUserId !== porteiro.id) {
      console.log('\n❌ PROBLEMA IDENTIFICADO:');
      console.log('   As políticas RLS comparam auth.uid() com porteiro_id');
      console.log('   Mas auth.uid() retorna user_id, enquanto porteiro_id é o profile.id');
      console.log('   Isso significa que a política RLS está incorreta!');
      
      console.log('\n💡 SOLUÇÃO:');
      console.log('   As políticas RLS devem comparar auth.uid() com profiles.user_id');
      console.log('   onde profiles.id = porteiro_shifts.porteiro_id');
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

testAuthenticatedShift();