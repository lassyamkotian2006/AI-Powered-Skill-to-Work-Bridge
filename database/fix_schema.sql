-- Run this in Supabase SQL Editor if you see "Database save skipped" warnings
-- This ensures the updated_at column exists for the skill tracking system

ALTER TABLE user_skills ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Also ensure user_job_matches has it if needed
ALTER TABLE user_job_matches ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- And the users table columns for the override
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS interests TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS target_role VARCHAR(255);
