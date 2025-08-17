-- Test SHA-256 hash for admin123 password
-- The correct SHA-256 hash for 'admin123' should be:
-- 240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9

-- Check current password hash in database
SELECT email, password_hash, user_type, is_active
FROM users 
WHERE email = 'admin@teste.com';

-- Update password hash if needed (SHA-256 of 'admin123')
UPDATE users 
SET password_hash = '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9'
WHERE email = 'admin@teste.com';

-- Also update other test users with correct hashes
-- SHA-256 of 'porteiro123': e258d248fda94c63753607f7c4494ee0fcbe92f1a76bfdac795c9d84101eb317
UPDATE users 
SET password_hash = 'e258d248fda94c63753607f7c4494ee0fcbe92f1a76bfdac795c9d84101eb317'
WHERE email = 'porteiro@teste.com';

-- SHA-256 of 'morador123': 8d23cf6c86e834a7aa6eded54c26ce2bb2e74903538c61bdd5d2197997ab2f72
UPDATE users 
SET password_hash = '8d23cf6c86e834a7aa6eded54c26ce2bb2e74903538c61bdd5d2197997ab2f72'
WHERE email = 'morador@teste.com';

-- Verify all updates
SELECT email, password_hash, user_type, is_active
FROM users 
WHERE email IN ('admin@teste.com', 'porteiro@teste.com', 'morador@teste.com')
ORDER BY email;