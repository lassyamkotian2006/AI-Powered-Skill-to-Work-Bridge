-- =============================================
-- AUTHENTICATION & SECURITY OVERHAUL
-- =============================================
-- Run this in Supabase SQL Editor

-- 1. Add new columns for email/password auth
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS interests TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS target_role VARCHAR(255);

-- 2. Modify github_id to be nullable (for users who register with email first)
ALTER TABLE users ALTER COLUMN github_id DROP NOT NULL;

-- 3. Add an index for email lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 4. Update existing users: If they have a verifiedEmail in session (this is a placeholder for manual update if needed)
-- UPDATE users SET is_email_verified = TRUE WHERE github_id IS NOT NULL;
