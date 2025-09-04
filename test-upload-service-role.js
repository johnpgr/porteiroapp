const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase com SERVICE ROLE (para teste)
const supabaseUrl = 'https://ycamhxzumzkpxuhtugxc.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYW1oeHp1bXprcHh1aHR1Z3hjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTcyMTAzMSwiZXhwIjoyMDcxMjk3MDMxfQ.5abRJDfQeKopRnaoYmFgoS7-0SoldraEMp_VPM7OjdQ';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testWithServiceRole() {
  console.log('🧪 Testando com SERVICE ROLE para diagnosticar o problema...');
  
  try {
    // 1. Verificar buckets com service role
    console.log('\n1. Listando buckets com service role...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('❌ Erro ao listar buckets:', bucketsError);
      return;
    }
    
    console.log('✅ Buckets encontrados:', buckets.map(b => b.name));
    
    const userPhotosBucket = buckets.find(bucket => bucket.name === 'user-photos');
    if (!userPhotosBucket) {
      console.error('❌ Bucket user-photos não encontrado mesmo com service role!');
      return;
    }
    
    console.log('✅ Bucket user-photos encontrado:', userPhotosBucket);
    
    // 2. Testar upload com service role
    console.log('\n2. Testando upload com service role...');
    const testFileName = `test-service-${Date.now()}.txt`;
    const testContent = 'Teste com service role';
    const testBuffer = Buffer.from(testContent, 'utf8');
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('user-photos')
      .upload(`test/${testFileName}`, testBuffer, {
        contentType: 'text/plain',
        upsert: true
      });
    
    if (uploadError) {
      console.error('❌ ERRO NO UPLOAD COM SERVICE ROLE:', uploadError);
      return;
    }
    
    console.log('✅ Upload com service role funcionou!');
    console.log('Dados do upload:', uploadData);
    
    // 3. Agora testar com anon key
    console.log('\n3. Testando com ANON KEY...');
    const supabaseAnon = createClient(supabaseUrl, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYW1oeHp1bXprcHh1aHR1Z3hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3MjEwMzEsImV4cCI6MjA3MTI5NzAzMX0.CBgkeAVbxlyJHftmVWSkSPefrbOdMckMvtakRTDpgc8');
    
    const { data: anonBuckets, error: anonBucketsError } = await supabaseAnon.storage.listBuckets();
    
    if (anonBucketsError) {
      console.error('❌ Erro ao listar buckets com anon key:', anonBucketsError);
    } else {
      console.log('✅ Buckets visíveis para anon key:', anonBuckets.map(b => b.name));
      
      const anonUserPhotosBucket = anonBuckets.find(bucket => bucket.name === 'user-photos');
      if (anonUserPhotosBucket) {
        console.log('✅ Bucket user-photos é visível para anon key!');
        
        // Testar upload com anon
        const anonTestFileName = `test-anon-${Date.now()}.txt`;
        const { data: anonUploadData, error: anonUploadError } = await supabaseAnon.storage
          .from('user-photos')
          .upload(`test/${anonTestFileName}`, testBuffer, {
            contentType: 'text/plain',
            upsert: true
          });
        
        if (anonUploadError) {
          console.error('❌ ERRO NO UPLOAD COM ANON KEY:', anonUploadError);
          console.error('Detalhes:', JSON.stringify(anonUploadError, null, 2));
        } else {
          console.log('✅ Upload com anon key funcionou!');
          console.log('🎉 PROBLEMA RESOLVIDO!');
        }
      } else {
        console.error('❌ Bucket user-photos NÃO é visível para anon key!');
        console.log('🔍 Este é o problema: o bucket não tem permissões corretas para anon.');
      }
    }
    
    // Limpar arquivos de teste
    await supabase.storage.from('user-photos').remove([`test/${testFileName}`]);
    
  } catch (error) {
    console.error('❌ Erro inesperado:', error);
  }
}

// Executar o teste
testWithServiceRole();