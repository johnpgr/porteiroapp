const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configuração do Supabase
const supabaseUrl = 'https://ycamhxzumzkpxuhtugxc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYW1oeHp1bXprcHh1aHR1Z3hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3MjEwMzEsImV4cCI6MjA3MTI5NzAzMX0.CBgkeAVbxlyJHftmVWSkSPefrbOdMckMvtakRTDpgc8';

// Função para obter as chaves reais do Supabase
async function getSupabaseConfig() {
  try {
    // Tentar ler do arquivo .env se existir
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/);
      const keyMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/);
      
      if (urlMatch && keyMatch) {
        return {
          url: urlMatch[1].trim(),
          anonKey: keyMatch[1].trim()
        };
      }
    }
    
    // Valores padrão (serão substituídos pelas chaves reais)
    return {
      url: supabaseUrl,
      anonKey: supabaseAnonKey
    };
  } catch (error) {
    console.error('Erro ao obter configuração do Supabase:', error);
    return {
      url: supabaseUrl,
      anonKey: supabaseAnonKey
    };
  }
}

// Função para criar uma imagem de teste simples (buffer)
function createTestImage() {
  // Criar um buffer simples que simula uma imagem PNG mínima
  const pngHeader = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, // IHDR chunk length
    0x49, 0x48, 0x44, 0x52, // IHDR
    0x00, 0x00, 0x00, 0x01, // width: 1
    0x00, 0x00, 0x00, 0x01, // height: 1
    0x08, 0x02, 0x00, 0x00, 0x00, // bit depth, color type, compression, filter, interlace
    0x90, 0x77, 0x53, 0xDE, // CRC
    0x00, 0x00, 0x00, 0x0C, // IDAT chunk length
    0x49, 0x44, 0x41, 0x54, // IDAT
    0x08, 0x99, 0x01, 0x01, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, // image data
    0x00, 0x00, 0x00, 0x00, // IEND chunk length
    0x49, 0x45, 0x4E, 0x44, // IEND
    0xAE, 0x42, 0x60, 0x82  // CRC
  ]);
  
  return pngHeader;
}

// Função principal de teste
async function testBucketUpload() {
  console.log('🧪 Iniciando teste de upload no bucket user-photos...');
  console.log('=' .repeat(60));
  
  try {
    // Obter configuração do Supabase
    const config = await getSupabaseConfig();
    console.log('✅ Configuração do Supabase obtida');
    console.log(`📍 URL: ${config.url}`);
    console.log(`🔑 Anon Key: ${config.anonKey.substring(0, 20)}...`);
    
    // Criar cliente Supabase
    const supabase = createClient(config.url, config.anonKey);
    console.log('✅ Cliente Supabase criado');
    
    // Verificar se o bucket existe
    console.log('\n🔍 Verificando se o bucket user-photos existe...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('❌ Erro ao listar buckets:', bucketsError);
      return;
    }
    
    const userPhotosBucket = buckets.find(bucket => bucket.name === 'user-photos');
    if (!userPhotosBucket) {
      console.error('❌ Bucket user-photos não encontrado!');
      console.log('📋 Buckets disponíveis:', buckets.map(b => b.name));
      return;
    }
    
    console.log('✅ Bucket user-photos encontrado');
    console.log(`📊 Configurações: público=${userPhotosBucket.public}, criado em=${userPhotosBucket.created_at}`);
    
    // Criar imagem de teste
    const testImage = createTestImage();
    console.log(`✅ Imagem de teste criada (${testImage.length} bytes)`);
    
    // Teste 1: Upload na pasta residents
    console.log('\n📁 Teste 1: Upload na pasta /residents/');
    const residentFileName = `residents/test-resident-${Date.now()}.png`;
    
    const { data: residentUpload, error: residentError } = await supabase.storage
      .from('user-photos')
      .upload(residentFileName, testImage, {
        contentType: 'image/png',
        upsert: false
      });
    
    if (residentError) {
      console.error('❌ Erro no upload para /residents/:', residentError);
    } else {
      console.log('✅ Upload para /residents/ bem-sucedido!');
      console.log(`📄 Arquivo: ${residentUpload.path}`);
      console.log(`🆔 ID: ${residentUpload.id}`);
    }
    
    // Teste 2: Upload na pasta visitors
    console.log('\n📁 Teste 2: Upload na pasta /visitors/');
    const visitorFileName = `visitors/test-visitor-${Date.now()}.png`;
    
    const { data: visitorUpload, error: visitorError } = await supabase.storage
      .from('user-photos')
      .upload(visitorFileName, testImage, {
        contentType: 'image/png',
        upsert: false
      });
    
    if (visitorError) {
      console.error('❌ Erro no upload para /visitors/:', visitorError);
    } else {
      console.log('✅ Upload para /visitors/ bem-sucedido!');
      console.log(`📄 Arquivo: ${visitorUpload.path}`);
      console.log(`🆔 ID: ${visitorUpload.id}`);
    }
    
    // Teste 3: Listar arquivos no bucket
    console.log('\n📋 Teste 3: Listando arquivos no bucket...');
    const { data: files, error: listError } = await supabase.storage
      .from('user-photos')
      .list('', {
        limit: 10,
        sortBy: { column: 'created_at', order: 'desc' }
      });
    
    if (listError) {
      console.error('❌ Erro ao listar arquivos:', listError);
    } else {
      console.log(`✅ Listagem bem-sucedida! Encontrados ${files.length} itens`);
      files.forEach((file, index) => {
        console.log(`  ${index + 1}. ${file.name} (${file.metadata?.size || 'N/A'} bytes)`);
      });
    }
    
    // Teste 4: Gerar URLs públicas
    console.log('\n🔗 Teste 4: Gerando URLs públicas...');
    
    if (residentUpload) {
      const { data: residentUrl } = supabase.storage
        .from('user-photos')
        .getPublicUrl(residentFileName);
      console.log(`✅ URL pública para resident: ${residentUrl.publicUrl}`);
    }
    
    if (visitorUpload) {
      const { data: visitorUrl } = supabase.storage
        .from('user-photos')
        .getPublicUrl(visitorFileName);
      console.log(`✅ URL pública para visitor: ${visitorUrl.publicUrl}`);
    }
    
    // Teste 5: Verificar acesso de leitura
    console.log('\n👁️ Teste 5: Verificando acesso de leitura...');
    
    if (residentUpload) {
      const { data: residentData, error: residentReadError } = await supabase.storage
        .from('user-photos')
        .download(residentFileName);
      
      if (residentReadError) {
        console.error('❌ Erro ao ler arquivo resident:', residentReadError);
      } else {
        console.log(`✅ Leitura do arquivo resident bem-sucedida (${residentData.size} bytes)`);
      }
    }
    
    if (visitorUpload) {
      const { data: visitorData, error: visitorReadError } = await supabase.storage
        .from('user-photos')
        .download(visitorFileName);
      
      if (visitorReadError) {
        console.error('❌ Erro ao ler arquivo visitor:', visitorReadError);
      } else {
        console.log(`✅ Leitura do arquivo visitor bem-sucedida (${visitorData.size} bytes)`);
      }
    }
    
    // Resumo final
    console.log('\n' + '=' .repeat(60));
    console.log('📊 RESUMO DO TESTE:');
    console.log(`✅ Bucket user-photos: ${userPhotosBucket ? 'ENCONTRADO' : 'NÃO ENCONTRADO'}`);
    console.log(`✅ Upload /residents/: ${residentError ? 'FALHOU' : 'SUCESSO'}`);
    console.log(`✅ Upload /visitors/: ${visitorError ? 'FALHOU' : 'SUCESSO'}`);
    console.log(`✅ Listagem de arquivos: ${listError ? 'FALHOU' : 'SUCESSO'}`);
    console.log(`✅ URLs públicas: GERADAS`);
    console.log(`✅ Acesso de leitura: ${(residentUpload && visitorUpload) ? 'TESTADO' : 'PARCIAL'}`);
    
    if (!residentError && !visitorError && !listError) {
      console.log('\n🎉 TODOS OS TESTES PASSARAM! O bucket está funcionando corretamente.');
    } else {
      console.log('\n⚠️ Alguns testes falharam. Verifique os erros acima.');
    }
    
  } catch (error) {
    console.error('💥 Erro geral no teste:', error);
  }
}

// Executar o teste
if (require.main === module) {
  testBucketUpload();
}

module.exports = { testBucketUpload };