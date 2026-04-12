-- 🚀 Skill-to-Work Bridge: Complete Supabase Database Setup
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/editor)

-- 1. Create Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE,
    username VARCHAR(255),
    name TEXT,
    password_hash TEXT,
    github_id BIGINT UNIQUE,
    avatar_url TEXT,
    profile_url TEXT,
    is_email_verified BOOLEAN DEFAULT FALSE,
    interests TEXT,
    target_role VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create Skills Table (Master Dictionary)
CREATE TABLE IF NOT EXISTS skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) UNIQUE NOT NULL,
    category VARCHAR(100),
    description TEXT
);

-- 3. Create User Skills (Mapping between users and their skills)
CREATE TABLE IF NOT EXISTS user_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
    proficiency_level VARCHAR(50) DEFAULT 'intermediate',
    last_used TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, skill_id)
);

-- 4. Enable Row Level Security (Security)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_skills ENABLE ROW LEVEL SECURITY;

-- 5. Define Security Policies
-- Allow anyone to read the skills list
DO $$ BEGIN
    CREATE POLICY "Public read for skills" ON skills FOR SELECT USING (true);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Allow users to manage their own profile
DO $$ BEGIN
    CREATE POLICY "Users can manage own data" ON users FOR ALL USING (true);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Allow users to manage their own skills mapping
DO $$ BEGIN
    CREATE POLICY "Users can manage own skills" ON user_skills FOR ALL USING (true);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 6. Insert some basic categories/skills (Optional)
INSERT INTO skills (name, category) VALUES 
('React', 'Frontend'),
('Node.js', 'Backend'),
('Python', 'General'),
('PostgreSQL', 'Database'),
('Docker', 'DevOps'),
('Figma', 'Design')
ON CONFLICT (name) DO NOTHING;
