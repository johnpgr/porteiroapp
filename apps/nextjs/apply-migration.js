console.log('=== MIGRAÇÃO SQL PARA TEMPORARY_PASSWORDS ===\n');
console.log('Execute os seguintes comandos SQL no Supabase Dashboard (SQL Editor):\n');

console.log('-- 1. Adicionar coluna visitor_id');
console.log('ALTER TABLE temporary_passwords ADD COLUMN visitor_id UUID REFERENCES visitors(id) ON DELETE CASCADE;\n');

console.log('-- 2. Modificar profile_id para permitir NULL');
console.log('ALTER TABLE temporary_passwords ALTER COLUMN profile_id DROP NOT NULL;\n');

console.log('-- 3. Adicionar constraint CHECK');
console.log(`ALTER TABLE temporary_passwords 
ADD CONSTRAINT check_profile_or_visitor 
CHECK (
  (profile_id IS NOT NULL AND visitor_id IS NULL) OR 
  (profile_id IS NULL AND visitor_id IS NOT NULL)
);\n`);

console.log('=== INSTRUÇÕES ===');
console.log('1. Acesse o Supabase Dashboard: https://supabase.com/dashboard');
console.log('2. Vá para o projeto: ycamhxzumzkpxuhtugxc');
console.log('3. Clique em "SQL Editor" no menu lateral');
console.log('4. Cole e execute cada comando SQL acima');
console.log('5. Após executar, volte aqui e continue com a atualização do código\n');

console.log('Após executar a migração SQL, o código será atualizado automaticamente.');