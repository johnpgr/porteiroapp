const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkPorteiros() {
  console.log('🔍 Verificando porteiros cadastrados...');
  
  try {
    // Consultar porteiros
    const { data: porteiros, error } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        email,
        user_type,
        building_id,
        buildings!profiles_building_id_fkey(name)
      `)
      .eq('user_type', 'porteiro');
    
    if (error) {
      console.error('❌ Erro ao consultar porteiros:', error);
      return;
    }
    
    console.log(`✅ Porteiros encontrados: ${porteiros.length}`);
    
    if (porteiros.length === 0) {
      console.log('⚠️  Nenhum porteiro cadastrado. Criando um porteiro de teste...');
      
      // Primeiro, verificar se há prédios
      const { data: buildings, error: buildingError } = await supabase
        .from('buildings')
        .select('id, name')
        .limit(1);
      
      if (buildingError || !buildings || buildings.length === 0) {
        console.log('⚠️  Nenhum prédio encontrado. Criando prédio de teste...');
        
        const { data: newBuilding, error: createBuildingError } = await supabase
          .from('buildings')
          .insert({
            name: 'Prédio Teste',
            address: 'Rua Teste, 123',
            city: 'São Paulo',
            state: 'SP',
            zip_code: '01234-567'
          })
          .select()
          .single();
        
        if (createBuildingError) {
          console.error('❌ Erro ao criar prédio:', createBuildingError);
          return;
        }
        
        console.log('✅ Prédio de teste criado:', newBuilding.name);
        
        // Criar porteiro de teste
        const { data: newPorteiro, error: createPorteiroError } = await supabase
          .from('profiles')
          .insert({
            id: '00000000-0000-0000-0000-000000000001',
            full_name: 'Porteiro Teste',
            email: 'porteiro.teste@example.com',
            user_type: 'porteiro',
            building_id: newBuilding.id,
            phone: '(11) 99999-9999'
          })
          .select()
          .single();
        
        if (createPorteiroError) {
          console.error('❌ Erro ao criar porteiro:', createPorteiroError);
          return;
        }
        
        console.log('✅ Porteiro de teste criado:', newPorteiro.full_name);
      } else {
        // Criar porteiro no primeiro prédio encontrado
        const { data: newPorteiro, error: createPorteiroError } = await supabase
          .from('profiles')
          .insert({
            id: '00000000-0000-0000-0000-000000000001',
            full_name: 'Porteiro Teste',
            email: 'porteiro.teste@example.com',
            user_type: 'porteiro',
            building_id: buildings[0].id,
            phone: '(11) 99999-9999'
          })
          .select()
          .single();
        
        if (createPorteiroError) {
          console.error('❌ Erro ao criar porteiro:', createPorteiroError);
          return;
        }
        
        console.log('✅ Porteiro de teste criado:', newPorteiro.full_name);
      }
    } else {
      porteiros.forEach(porteiro => {
        console.log(`   - ${porteiro.full_name} (${porteiro.email}) - Prédio: ${porteiro.buildings?.name || 'N/A'}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

checkPorteiros();