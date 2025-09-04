const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = 'https://ycamhxzumzkpxuhtugxc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYW1oeHp1bXprcHh1aHR1Z3hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3MjEwMzEsImV4cCI6MjA3MTI5NzAzMX0.CBgkeAVbxlyJHftmVWSkSPefrbOdMckMvtakRTDpgc8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testImageUpload() {
  console.log('🧪 Testando upload de imagem no bucket user-photos...');
  
  try {
    // 1. Verificar se o bucket existe
    console.log('\n1. Verificando buckets disponíveis...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('❌ Erro ao listar buckets:', bucketsError);
      return;
    }
    
    console.log('✅ Buckets encontrados:', buckets.map(b => b.name));
    
    const userPhotosBucket = buckets.find(bucket => bucket.name === 'user-photos');
    if (!userPhotosBucket) {
      console.error('❌ Bucket user-photos não encontrado!');
      console.log('🔍 Buckets disponíveis:', buckets.map(b => ({ name: b.name, public: b.public })));
      return;
    }
    
    console.log('✅ Bucket user-photos encontrado:', {
      name: userPhotosBucket.name,
      public: userPhotosBucket.public,
      file_size_limit: userPhotosBucket.file_size_limit,
      allowed_mime_types: userPhotosBucket.allowed_mime_types
    });
    
    // 2. Criar uma imagem de teste simples (1x1 pixel PNG)
    console.log('\n2. Criando imagem de teste...');
    // PNG de 1x1 pixel transparente (base64)
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77zgAAAABJRU5ErkJggg==';
    const imageBuffer = Buffer.from(pngBase64, 'base64');
    
    console.log('✅ Imagem de teste criada (PNG 1x1 pixel, tamanho:', imageBuffer.length, 'bytes)');
    
    // 3. Tentar fazer upload da imagem
    console.log('\n3. Tentando fazer upload da imagem...');
    const testFileName = `test-image-${Date.now()}.png`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('user-photos')
      .upload(`test/${testFileName}`, imageBuffer, {
        contentType: 'image/png',
        upsert: true
      });
    
    if (uploadError) {
      console.error('❌ ERRO NO UPLOAD DA IMAGEM:', uploadError);
      console.error('Detalhes completos do erro:', JSON.stringify(uploadError, null, 2));
      
      // Verificar se é erro de RLS
      if (uploadError.message && uploadError.message.includes('row-level security')) {
        console.log('🚨 CONFIRMADO: Erro de Row Level Security (RLS)');
        console.log('🔧 As políticas RLS ainda estão bloqueando o upload!');
      }
      
      return;
    }
    
    console.log('✅ Upload da imagem realizado com sucesso!');
    console.log('Dados do upload:', uploadData);
    
    // 4. Verificar se o arquivo foi criado
    console.log('\n4. Verificando se o arquivo foi criado...');
    const { data: files, error: listError } = await supabase.storage
      .from('user-photos')
      .list('test');
    
    if (listError) {
      console.error('❌ Erro ao listar arquivos:', listError);
    } else {
      const uploadedFile = files.find(file => file.name === testFileName);
      if (uploadedFile) {
        console.log('✅ Arquivo encontrado na listagem:', uploadedFile);
      } else {
        console.error('❌ Arquivo não encontrado na listagem!');
      }
    }
    
    // 5. Obter URL pública
    console.log('\n5. Obtendo URL pública...');
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
    console.log('✅ O bucket user-photos está funcionando corretamente!');
    console.log('✅ O erro de RLS foi RESOLVIDO!');
    
  } catch (error) {
    console.error('❌ Erro inesperado durante o teste:', error);
  }
}

// Executar o teste
testImageUpload();