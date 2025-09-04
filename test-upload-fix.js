const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configuração do Supabase
const supabaseUrl = 'https://ycamhxzumzkpxuhtugxc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYW1oeHp1bXprcHh1aHR1Z3hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3MjEwMzEsImV4cCI6MjA3MTI5NzAzMX0.CBgkeAVbxlyJHftmVWSkSPefrbOdMckMvtakRTDpgc8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testUploadFunctionality() {
  console.log('🧪 Testando funcionalidade de upload no bucket user-photos...');
  
  try {
    // 1. Verificar se o bucket existe
    console.log('\n1. Verificando se o bucket user-photos existe...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('❌ Erro ao listar buckets:', bucketsError);
      return;
    }
    
    const userPhotosBucket = buckets.find(bucket => bucket.name === 'user-photos');
    if (!userPhotosBucket) {
      console.error('❌ Bucket user-photos não encontrado!');
      return;
    }
    
    console.log('✅ Bucket user-photos encontrado:', userPhotosBucket);
    
    // 2. Criar um arquivo de teste simples
    console.log('\n2. Criando arquivo de teste...');
    const testFileName = `test-${Date.now()}.txt`;
    const testContent = 'Este é um arquivo de teste para verificar o upload.';
    const testBuffer = Buffer.from(testContent, 'utf8');
    
    // 3. Tentar fazer upload do arquivo
    console.log('\n3. Tentando fazer upload do arquivo de teste...');
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('user-photos')
      .upload(`test/${testFileName}`, testBuffer, {
        contentType: 'text/plain',
        upsert: true
      });
    
    if (uploadError) {
      console.error('❌ ERRO NO UPLOAD:', uploadError);
      console.error('Detalhes do erro:', JSON.stringify(uploadError, null, 2));
      return;
    }
    
    console.log('✅ Upload realizado com sucesso!');
    console.log('Dados do upload:', uploadData);
    
    // 4. Verificar se o arquivo foi realmente criado
    console.log('\n4. Verificando se o arquivo foi criado...');
    const { data: files, error: listError } = await supabase.storage
      .from('user-photos')
      .list('test');
    
    if (listError) {
      console.error('❌ Erro ao listar arquivos:', listError);
      return;
    }
    
    const uploadedFile = files.find(file => file.name === testFileName);
    if (uploadedFile) {
      console.log('✅ Arquivo encontrado na listagem:', uploadedFile);
    } else {
      console.error('❌ Arquivo não encontrado na listagem!');
    }
    
    // 5. Tentar obter URL pública
    console.log('\n5. Obtendo URL pública do arquivo...');
    const { data: publicUrlData } = supabase.storage
      .from('user-photos')
      .getPublicUrl(`test/${testFileName}`);
    
    console.log('✅ URL pública gerada:', publicUrlData.publicUrl);
    
    // 6. Limpar - remover arquivo de teste
    console.log('\n6. Removendo arquivo de teste...');
    const { error: deleteError } = await supabase.storage
      .from('user-photos')
      .remove([`test/${testFileName}`]);
    
    if (deleteError) {
      console.error('⚠️ Erro ao remover arquivo de teste:', deleteError);
    } else {
      console.log('✅ Arquivo de teste removido com sucesso!');
    }
    
    console.log('\n🎉 TESTE CONCLUÍDO COM SUCESSO!');
    console.log('O bucket user-photos está funcionando corretamente para upload!');
    
  } catch (error) {
    console.error('❌ Erro inesperado durante o teste:', error);
  }
}

// Executar o teste
testUploadFunctionality();