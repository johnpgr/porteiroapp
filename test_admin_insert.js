// Script de teste para verificar inserção com usuário admin autenticado
const { createClient } = require('@supabase/supabase-js');

// Configurações do Supabase
const supabaseUrl = 'https://ycamhxzumzkpxuhtugxc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYW1oeHp1bXprcHh1aHR1Z3hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3MjEwMzEsImV4cCI6MjA3MTI5NzAzMX0.CBgkeAVbxlyJHftmVWSkSPefrbOdMckMvtakRTDpgc8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testAdminInsert() {
  console.log('🧪 Testando inserção com usuário admin...');
  
  try {
    // Primeiro, vamos verificar se há admins e prédios no banco
    console.log('\n📋 Verificando dados existentes...');
    
    const { data: admins, error: adminError } = await supabase
      .from('admin_profiles')
      .select('*')
      .limit(5);
    
    if (adminError) {
      console.log('❌ Erro ao buscar admins:', adminError.message);
      return;
    }
    
    console.log('👥 Admins encontrados:', admins?.length || 0);
    if (admins && admins.length > 0) {
      console.log('📝 Primeiro admin:', {
        id: admins[0].id,
        name: admins[0].name,
        email: admins[0].email,
        role: admins[0].role
      });
    }
    
    const { data: buildings, error: buildingError } = await supabase
      .from('buildings')
      .select('*')
      .limit(5);
    
    if (buildingError) {
      console.log('❌ Erro ao buscar prédios:', buildingError.message);
      return;
    }
    
    console.log('🏢 Prédios encontrados:', buildings?.length || 0);
    if (buildings && buildings.length > 0) {
      console.log('📝 Primeiro prédio:', {
        id: buildings[0].id,
        name: buildings[0].name,
        address: buildings[0].address
      });
    }
    
    // Agora vamos tentar inserir um comunicado com dados válidos
    if (admins && admins.length > 0 && buildings && buildings.length > 0) {
      console.log('\n✍️ Tentando inserir comunicado com dados válidos...');
      
      const { data: insertData, error: insertError } = await supabase
        .from('communications')
        .insert({
          title: 'Teste RLS - Comunicado de Teste',
          content: 'Este é um teste para verificar se as políticas RLS estão funcionando corretamente.',
          type: 'notice',
          priority: 'normal',
          building_id: buildings[0].id,
          created_by: admins[0].id
        })
        .select();
      
      if (insertError) {
        console.log('❌ Erro na inserção:', insertError.message);
        console.log('🔍 Detalhes do erro:', insertError);
      } else {
        console.log('✅ Comunicado inserido com sucesso!');
        console.log('📝 Dados inseridos:', insertData);
        
        // Limpar o teste - deletar o registro inserido
        if (insertData && insertData.length > 0) {
          const { error: deleteError } = await supabase
            .from('communications')
            .delete()
            .eq('id', insertData[0].id);
          
          if (deleteError) {
            console.log('⚠️ Erro ao limpar teste:', deleteError.message);
          } else {
            console.log('🧹 Registro de teste removido com sucesso');
          }
        }
      }
    } else {
      console.log('⚠️ Não há dados suficientes para testar (precisa de admin e prédio)');
    }
    
  } catch (error) {
    console.error('💥 Erro no teste:', error);
  }
}

// Executar o teste
testAdminInsert();