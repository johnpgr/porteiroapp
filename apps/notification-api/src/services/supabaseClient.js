const { createClient } = require('@supabase/supabase-js');
// Environment variables accessed via process.env

// Criar cliente Supabase com service role para operações administrativas
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

module.exports = { supabase };