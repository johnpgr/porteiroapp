const express = require('express');
const { z } = require('zod');
const bcrypt = require('bcrypt');
const { createClient } = require('@supabase/supabase-js');
const { sendWhatsApp } = require('../services/whatsappService');
const multer = require('multer');
const router = express.Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || 'https://ycamhxzumzkpxuhtugxc.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYW1oeHp1bXprcHh1aHR1Z3hjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTcyMTAzMSwiZXhwIjoyMDcxMjk3MDMxfQ.5abRJDfQeKopRnaoYmFgoS7-0SoldraEMp_VPM7OjdQ';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Validation schema for resident registration
const registerResidentSchema = z.object({
  full_name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  phone: z.string().min(10, 'Telefone deve ter pelo menos 10 dígitos'),
  building_id: z.string().uuid('ID do prédio inválido').optional(),
  apartment_number: z.string().min(1, 'Número do apartamento é obrigatório')
});

// Test endpoint that returns the WhatsApp message format without database operations
router.post('/test-whatsapp-message', async (req, res) => {
  try {
    const { full_name, email, phone, apartment_number } = req.body;

    if (!full_name || !email || !phone || !apartment_number) {
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios: full_name, email, phone, apartment_number'
      });
    }

    // Generate a test temporary password
    const temporaryPassword = 'Test123!';

    // Create the WhatsApp message format (using test profileId)
    const testProfileId = require('crypto').randomUUID();
    const siteUrl = 'porteiroapp://login';
    const completarCadastroUrl = `porteiroapp://cadastro/morador/completar?profileId=${testProfileId}`;

    const whatsappMessage = `🎉 *Bem-vindo ao JamesAvisa!*

✅ *Seu cadastro foi iniciado com sucesso!*

🏢 *Condomínio:* Edifício Teste
🏠 *Apartamento:* ${apartment_number}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔐 *SUAS CREDENCIAIS DE ACESSO:*

📧 *E-mail:* ${email}
📱 *Usuário (Celular):* ${phone}
🔑 *Senha temporária:* ${temporaryPassword}

💡 *IMPORTANTE:* Use seu número de celular como usuário para fazer login!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🌐 *COMPLETE SEU CADASTRO:*

🔗 *Clique aqui para finalizar:*
${completarCadastroUrl}`;

    return res.json({
      success: true,
      message: 'Mensagem de teste gerada com sucesso',
      whatsapp_message: whatsappMessage,
      credentials: {
        email,
        phone,
        temporary_password: temporaryPassword
      }
    });

  } catch (error) {
    console.error('Erro no endpoint de teste:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Validation schema for profile completion
const completeProfileSchema = z.object({
  profile_id: z.string().uuid('ID do perfil inválido'),
  cpf: z.string().min(11, 'CPF deve ter 11 dígitos'),
  birth_date: z.string().optional(),
  address: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  new_password: z.string().min(6, 'Nova senha deve ter pelo menos 6 caracteres')
});

/**
 * POST /api/register-resident
 * Creates real user in Supabase Auth and profile in database
 */
router.post('/register-resident', async (req, res) => {
  try {
    console.log('Criando usuário real no sistema:', req.body);

    const { name, phone, building, apartment, building_id, temporary_password } = req.body;

    if (!name || !phone || !building || !apartment) {
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios: name, phone, building, apartment'
      });
    }

    // Generate real email for user creation
    const email = `${phone}@temp.jamesconcierge.com`;
    const finalTemporaryPassword = temporary_password || 'Temp123!';

    console.log('Criando usuário real:', { name, phone, building, apartment, email });

    // Step 1: Create real user in Supabase Auth
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: email,
      password: finalTemporaryPassword,
      phone: phone,
      email_confirm: true,
      phone_confirm: true,
      user_metadata: {
        full_name: name,
        phone: phone,
        building: building,
        apartment: apartment
      }
    });

    if (authError) {
      console.error('Erro ao criar usuário no Auth:', authError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar usuário no sistema de autenticação'
      });
    }

    // Step 2: Create real profile in profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert({
        user_id: authUser.user.id,
        email: email,
        full_name: name,
        phone: phone,
        building_id: building_id || null,
        apartment_number: apartment,
        user_type: 'morador',
        profile_complete: false,
        temporary_password_used: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (profileError) {
      console.error('Erro ao criar perfil:', profileError);
      // Rollback: delete the auth user if profile creation fails
      await supabase.auth.admin.deleteUser(authUser.user.id);
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar perfil do usuário'
      });
    }

    // Step 3: Store temporary password record
    await supabase
      .from('temporary_passwords')
      .insert({
        profile_id: profile.id,
        plain_password: finalTemporaryPassword,
        used: false,
        created_at: new Date().toISOString()
      });

    console.log('Usuário criado com sucesso. ProfileId real:', profile.id);

    // Step 4: Send WhatsApp notification with REAL profileId
    const siteUrl = process.env.SITE_URL || 'porteiroapp://login';
    const completarCadastroUrl = `porteiroapp://cadastro/morador/completar?profileId=${profile.id}`;
    const whatsappMessage = `🏢 JamesAvisa - Cadastro de Morador

Olá *${name}*!

Você foi convidado(a) para se cadastrar no JamesAvisa.

📍 Dados do seu apartamento:

🏢 Prédio: ${building}

🚪 Apartamento: ${apartment}

Para completar seu cadastro, clique no link abaixo:

${completarCadastroUrl}

🔐 SUAS CREDENCIAIS DE ACESSO:

📱 Usuário (Celular): ${phone}

🔑 Senha temporária: ${finalTemporaryPassword}

💡 IMPORTANTE: Use seu número de celular como usuário para fazer login!

Com o JamesAvisa você pode:

✅ Receber visitantes com mais segurança

✅ Autorizar entregas remotamente

✅ Comunicar-se diretamente com a portaria

✅ Acompanhar movimentações do seu apartamento

Mensagem enviada automaticamente pelo sistema JamesAvisa`

    try {
      await sendWhatsApp({
        to: phone,
        message: whatsappMessage
      });
      console.log('WhatsApp enviado com sucesso para:', phone);
    } catch (whatsappError) {
      console.error('Erro ao enviar WhatsApp:', whatsappError.message);
      // Don't fail the registration if WhatsApp fails - user was already created
    }

    res.json({
      success: true,
      message: 'Usuário criado com sucesso! Verifique seu WhatsApp para as credenciais de acesso.',
      data: {
          profile_id: profile.id, // REAL profileId from database
          user_id: authUser.user.id,
          email: email,
          building_name: building,
          apartment_number: apartment,
          temporary_password: finalTemporaryPassword
        }
    });

  } catch (error) {
    console.error('Erro no cadastro de morador:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * POST /api/complete-profile
 * Completes resident profile with personal data and new password
 */
router.post('/complete-profile', async (req, res) => {
  try {
    console.log('Completando perfil:', req.body);

    // Validate input data
    const validatedData = completeProfileSchema.parse(req.body);
    const { profile_id, cpf, birth_date, address, emergency_contact_name, emergency_contact_phone, new_password } = validatedData;

    // Get profile and user info
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, email, profile_complete')
      .eq('id', profile_id)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({
        success: false,
        error: 'Perfil não encontrado'
      });
    }

    if (profile.profile_complete) {
      return res.status(400).json({
        success: false,
        error: 'Perfil já foi completado'
      });
    }

    // Check if CPF already exists (excluding current profile)
    const { data: existingCpf } = await supabase
      .from('profiles')
      .select('id')
      .eq('cpf', cpf)
      .neq('id', profile_id)
      .single();

    if (existingCpf) {
      return res.status(400).json({
        success: false,
        error: 'CPF já cadastrado no sistema'
      });
    }

    // Update user password in Auth
    const { error: passwordError } = await supabase.auth.admin.updateUserById(
      profile.user_id,
      { password: new_password }
    );

    if (passwordError) {
      console.error('Erro ao atualizar senha:', passwordError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar senha'
      });
    }

    // Update profile with complete data
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        cpf,
        birth_date,
        address,
        emergency_contact_name,
        emergency_contact_phone,
        profile_complete: true,
        temporary_password_used: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', profile_id);

    if (updateError) {
      console.error('Erro ao atualizar perfil:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao completar perfil'
      });
    }

    // Mark temporary password as used
    await supabase
      .from('temporary_passwords')
      .update({
        used: true,
        used_at: new Date().toISOString(),
        plain_password: null // Clear plain password for security
      })
      .eq('profile_id', profile_id)
      .eq('used', false);

    res.json({
      success: true,
      message: 'Perfil completado com sucesso! Você já pode fazer login com sua nova senha.'
    });

  } catch (error) {
    console.error('Erro ao completar perfil:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Photo upload endpoint
router.post('/upload-profile-photo', upload.single('photo'), async (req, res) => {
  try {
    const { profileId } = req.body;

    if (!profileId) {
      return res.status(400).json({ error: 'Profile ID is required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Photo file is required' });
    }

    // Upload to Supabase Storage
    const fileName = `profile-photos/${profileId}-${Date.now()}.${req.file.originalname.split('.').pop()}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('profile-photos')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return res.status(500).json({ error: 'Failed to upload photo' });
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('profile-photos')
      .getPublicUrl(fileName);

    // Update profile with avatar URL
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', profileId);

    if (updateError) {
      console.error('Profile update error:', updateError);
      return res.status(500).json({ error: 'Failed to update profile with photo' });
    }

    res.json({
      success: true,
      avatar_url: publicUrl,
      message: 'Photo uploaded successfully'
    });

  } catch (error) {
    console.error('Upload photo error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;