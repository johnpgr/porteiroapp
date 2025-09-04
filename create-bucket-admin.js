// Script para criar o bucket user-photos usando service_role_key
const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase com service role key
const supabaseUrl = 'https://ycamhxzumzkpxuhtugxc.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYW1oeHp1bXprcHh1aHR1Z3hjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTcyMTAzMSwiZXhwIjoyMDcxMjk3MDMxfQ.5abRJDfQeKopRnaoYmFgoS7-0SoldraEMp_VPM7OjdQ';

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createUserPhotosBucket() {
  console.log('🔧 Criando bucket user-photos com permissões administrativas...');
  
  try {
    // 1. Verificar buckets existentes
    console.log('\n1. Verificando buckets existentes...');
    const { data: existingBuckets, error: listError } = await supabaseAdmin.storage.listBuckets();
    
    if (listError) {
      console.error('❌ Erro ao listar buckets:', listError);
      return;
    }
    
    console.log('✅ Buckets existentes:', existingBuckets.map(b => b.id));
    
    // 2. Verificar se o bucket user-photos já existe
    const userPhotosBucket = existingBuckets.find(bucket => bucket.id === 'user-photos');
    if (userPhotosBucket) {
      console.log('✅ Bucket user-photos já existe!');
      console.log('   - Configurações atuais:', userPhotosBucket);
      return;
    }
    
    // 3. Criar o bucket user-photos
    console.log('\n2. Criando bucket user-photos...');
    const { data: newBucket, error: createError } = await supabaseAdmin.storage.createBucket('user-photos', {
      public: true,
      fileSizeLimit: 5242880, // 5MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
    });
    
    if (createError) {
      console.error('❌ Erro ao criar bucket:', createError);
      return;
    }
    
    console.log('✅ Bucket user-photos criado com sucesso!');
    console.log('   - Dados do bucket:', newBucket);
    
    // 4. Verificar se foi criado corretamente
    console.log('\n3. Verificando se o bucket foi criado...');
    const { data: updatedBuckets, error: verifyError } = await supabaseAdmin.storage.listBuckets();
    
    if (verifyError) {
      console.error('❌ Erro ao verificar buckets:', verifyError);
      return;
    }
    
    const createdBucket = updatedBuckets.find(bucket => bucket.id === 'user-photos');
    if (createdBucket) {
      console.log('✅ Bucket user-photos confirmado!');
      console.log('   - ID:', createdBucket.id);
      console.log('   - Nome:', createdBucket.name);
      console.log('   - Público:', createdBucket.public);
      console.log('   - Limite de tamanho:', createdBucket.file_size_limit, 'bytes');
      console.log('   - Tipos MIME permitidos:', createdBucket.allowed_mime_types);
    } else {
      console.log('❌ Bucket não foi encontrado após criação!');
    }
    
    console.log('\n🎉 Processo de criação do bucket concluído!');
    
  } catch (error) {
    console.error('❌ Erro durante a criação do bucket:', error);
  }
}

// Executar a criação do bucket
createUserPhotosBucket();