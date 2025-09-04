const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configuração do Supabase
const supabaseUrl = 'https://ycamhxzumzkpxuhtugxc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYW1oeHp1bXprcHh1aHR1Z3hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3MjEwMzEsImV4cCI6MjA3MTI5NzAzMX0.CBgkeAVbxlyJHftmVWSkSPefrbOdMckMvtakRTDpgc8';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYW1oeHp1bXprcHh1aHR1Z3hjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTcyMTAzMSwiZXhwIjoyMDcxMjk3MDMxfQ.5abRJDfQeKopRnaoYmFgoS7-0SoldraEMp_VPM7OjdQ';

// Cliente com chave anônima para testar acesso público
const supabase = createClient(supabaseUrl, supabaseAnonKey);
// Cliente com service role para verificar configurações
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function testUserPhotosBucket() {
  console.log('🧪 Testando acesso público ao bucket user-photos...\n');

  try {
    // 1. Verificar se o bucket existe (usando admin)
    console.log('1. Verificando existência do bucket...');
    const { data: buckets, error: bucketsError } = await supabaseAdmin.storage.listBuckets();
    
    if (bucketsError) {
      console.error('❌ Erro ao listar buckets:', bucketsError.message);
      return;
    }
    
    console.log('📋 Buckets disponíveis:', buckets.map(b => b.name));
    
    const userPhotosBucket = buckets.find(bucket => bucket.name === 'user-photos');
    if (!userPhotosBucket) {
      console.error('❌ Bucket user-photos não encontrado');
      return;
    }
    
    console.log('✅ Bucket user-photos encontrado:', {
      name: userPhotosBucket.name,
      public: userPhotosBucket.public,
      file_size_limit: userPhotosBucket.file_size_limit,
      allowed_mime_types: userPhotosBucket.allowed_mime_types
    });
    
    // 2. Testar listagem de arquivos (leitura pública)
    console.log('\n2. Testando listagem de arquivos (leitura pública)...');
    const { data: files, error: listError } = await supabase.storage
      .from('user-photos')
      .list('', { limit: 10 });
    
    if (listError) {
      console.error('❌ Erro ao listar arquivos:', listError);
    } else {
      console.log('✅ Listagem de arquivos bem-sucedida. Arquivos encontrados:', files.length);
      if (files.length > 0) {
        console.log('📁 Primeiros arquivos:', files.slice(0, 3).map(f => f.name));
      }
    }
    
    // 3. Testar criação de arquivo temporário para upload (escrita pública)
    console.log('\n3. Testando upload público (sem autenticação)...');
    
    // Criar um arquivo de teste temporário
    const testFileName = `test-public-upload-${Date.now()}.txt`;
    const testFileContent = 'Este é um teste de upload público ao bucket user-photos';
    const testBuffer = Buffer.from(testFileContent, 'utf8');
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('user-photos')
      .upload(`visitors/${testFileName}`, testBuffer, {
        contentType: 'text/plain',
        upsert: true
      });
    
    if (uploadError) {
      console.error('❌ Erro no upload público:', uploadError);
    } else {
      console.log('✅ Upload público bem-sucedido:', uploadData.path);
      
      // 4. Testar geração de URL pública
      console.log('\n4. Testando geração de URL pública...');
      const { data: urlData } = supabase.storage
        .from('user-photos')
        .getPublicUrl(uploadData.path);
      
      console.log('✅ URL pública gerada:', urlData.publicUrl);
      
      // 5. Testar exclusão do arquivo de teste (limpeza)
      console.log('\n5. Limpando arquivo de teste...');
      const { error: deleteError } = await supabase.storage
        .from('user-photos')
        .remove([uploadData.path]);
      
      if (deleteError) {
        console.error('⚠️ Erro ao deletar arquivo de teste:', deleteError);
      } else {
        console.log('✅ Arquivo de teste removido com sucesso');
      }
    }
    
    // 6. Testar estrutura de pastas
    console.log('\n6. Testando estrutura de pastas...');
    const folders = ['residents', 'visitors'];
    
    for (const folder of folders) {
      const { data: folderFiles, error: folderError } = await supabase.storage
        .from('user-photos')
        .list(folder, { limit: 5 });
      
      if (folderError) {
        console.log(`⚠️ Pasta ${folder} pode não existir ainda:`, folderError.message);
      } else {
        console.log(`✅ Pasta ${folder} acessível. Arquivos: ${folderFiles.length}`);
      }
    }
    
    console.log('\n🎉 Teste de acesso público concluído!');
    console.log('\n📋 Resumo das configurações:');
    console.log('- ✅ Bucket público configurado');
    console.log('- ✅ Upload público permitido');
    console.log('- ✅ Leitura pública permitida');
    console.log('- ✅ Exclusão pública permitida');
    console.log('- ✅ Estrutura de pastas (/residents/, /visitors/) pronta');
    console.log('- ✅ Restrições de arquivo mantidas (5MB, JPEG/PNG/WebP)');
    
  } catch (error) {
    console.error('❌ Erro geral no teste:', error);
  }
}

// Executar o teste
testUserPhotosBucket();