// Script de teste para verificar upload com cliente administrativo
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ycamhxzumzkpxuhtugxc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYW1oeHp1bXprcHh1aHR1Z3hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3MjEwMzEsImV4cCI6MjA3MTI5NzAzMX0.CBgkeAVbxlyJHftmVWSkSPefrbOdMckMvtakRTDpgc8';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYW1oeHp1bXprcHh1aHR1Z3hjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTcyMTAzMSwiZXhwIjoyMDcxMjk3MDMxfQ.5abRJDfQeKopRnaoYmFgoS7-0SoldraEMp_VPM7OjdQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testStorageWithAdmin() {
  console.log('🔍 Testando upload com cliente administrativo...');
  
  try {
    // 1. Testar listagem de buckets com cliente admin
    console.log('\n1. Listando buckets com cliente admin...');
    const { data: buckets, error: bucketsError } = await supabaseAdmin.storage.listBuckets();
    
    if (bucketsError) {
      console.error('❌ Erro ao listar buckets:', bucketsError);
    } else {
      console.log('✅ Buckets encontrados:', buckets.map(b => b.name));
      
      // Verificar se o bucket delivery-visitor-photos existe
      const targetBucket = buckets.find(b => b.name === 'delivery-visitor-photos');
      if (targetBucket) {
        console.log('✅ Bucket delivery-visitor-photos encontrado:', targetBucket);
      } else {
        console.log('❌ Bucket delivery-visitor-photos NÃO encontrado!');
        return;
      }
    }
    
    // 2. Testar upload com cliente administrativo
    console.log('\n2. Testando upload com cliente administrativo...');
    const testData = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A';
    
    const response = await fetch(testData);
    const blob = await response.blob();
    
    const testFileName = `admin-test-${Date.now()}.jpg`;
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('delivery-visitor-photos')
      .upload(testFileName, blob, {
        contentType: 'image/jpeg',
        upsert: false
      });
    
    if (uploadError) {
      console.error('❌ Erro no upload com cliente admin:', uploadError);
    } else {
      console.log('✅ Upload com cliente admin bem-sucedido:', uploadData);
      
      // 3. Testar obtenção da URL pública
      console.log('\n3. Testando URL pública...');
      const { data: urlData } = supabase.storage
        .from('delivery-visitor-photos')
        .getPublicUrl(testFileName);
      
      console.log('✅ URL pública gerada:', urlData.publicUrl);
      
      // 4. Testar se a URL é acessível
      console.log('\n4. Testando acesso à URL pública...');
      try {
        const urlResponse = await fetch(urlData.publicUrl);
        if (urlResponse.ok) {
          console.log('✅ URL pública acessível, status:', urlResponse.status);
        } else {
          console.log('⚠️ URL pública retornou status:', urlResponse.status);
        }
      } catch (urlError) {
        console.error('❌ Erro ao acessar URL pública:', urlError.message);
      }
      
      // 5. Limpar arquivo de teste
      console.log('\n5. Removendo arquivo de teste...');
      const { error: deleteError } = await supabaseAdmin.storage
        .from('delivery-visitor-photos')
        .remove([testFileName]);
      
      if (deleteError) {
        console.warn('⚠️ Erro ao remover arquivo de teste:', deleteError);
      } else {
        console.log('✅ Arquivo de teste removido com sucesso');
      }
    }
    
    // 6. Testar upload com cliente anônimo (para comparação)
    console.log('\n6. Testando upload com cliente anônimo (deve falhar)...');
    const anonTestFileName = `anon-test-${Date.now()}.jpg`;
    const { data: anonUploadData, error: anonUploadError } = await supabase.storage
      .from('delivery-visitor-photos')
      .upload(anonTestFileName, blob, {
        contentType: 'image/jpeg',
        upsert: false
      });
    
    if (anonUploadError) {
      console.log('✅ Upload com cliente anônimo falhou como esperado:', anonUploadError.message);
    } else {
      console.log('⚠️ Upload com cliente anônimo funcionou (inesperado):', anonUploadData);
    }
    
  } catch (error) {
    console.error('❌ Erro geral no teste:', error);
  }
}

// Executar teste
testStorageWithAdmin().then(() => {
  console.log('\n🏁 Teste concluído');
}).catch(error => {
  console.error('💥 Erro fatal no teste:', error);
});