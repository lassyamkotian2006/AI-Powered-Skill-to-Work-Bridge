-- =============================================
-- SKILL-TO-WORK BRIDGE DATABASE SCHEMA
-- =============================================
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard
-- Go to your project → SQL Editor → New Query → Paste this → Run

-- 1. USERS TABLE
-- Stores GitHub user info after OAuth login
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    github_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    avatar_url TEXT,
    profile_url TEXT,
    access_token TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. REPOSITORIES TABLE
-- Stores user's GitHub repositories
CREATE TABLE IF NOT EXISTS repositories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    github_repo_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    description TEXT,
    url TEXT,
    languages JSONB DEFAULT '{}',
    readme_content TEXT,
    is_private BOOLEAN DEFAULT FALSE,
    stars INTEGER DEFAULT 0,
    forks INTEGER DEFAULT 0,
    last_commit_at TIMESTAMP,
    analyzed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, github_repo_id)
);

-- 3. SKILLS TABLE
-- Master list of all technical skills
CREATE TABLE IF NOT EXISTS skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(50),
    parent_skill_id UUID REFERENCES skills(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 4. USER_SKILLS TABLE
-- Skills extracted from user's repositories
CREATE TABLE IF NOT EXISTS user_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
    proficiency_level VARCHAR(20),
    confidence_score DECIMAL(3,2),
    repo_count INTEGER DEFAULT 1,
    last_used_at TIMESTAMP,
    evidence TEXT[],
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, skill_id)
);

-- 5. JOB_ROLES TABLE
-- Available job roles to match against
CREATE TABLE IF NOT EXISTS job_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    experience_level VARCHAR(50),
    salary_range_min INTEGER,
    salary_range_max INTEGER,
    demand_score INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 6. JOB_SKILLS TABLE
-- Skills required for each job role
CREATE TABLE IF NOT EXISTS job_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_role_id UUID REFERENCES job_roles(id) ON DELETE CASCADE,
    skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
    importance VARCHAR(20),
    min_proficiency VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(job_role_id, skill_id)
);

-- 7. USER_JOB_MATCHES TABLE
-- Job recommendations for users
CREATE TABLE IF NOT EXISTS user_job_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    job_role_id UUID REFERENCES job_roles(id) ON DELETE CASCADE,
    match_score DECIMAL(5,2),
    matching_skills JSONB,
    missing_skills JSONB,
    recommendation_text TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, job_role_id)
);

-- 8. LEARNING_RESOURCES TABLE
-- Courses, tutorials, and resources
CREATE TABLE IF NOT EXISTS learning_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    platform VARCHAR(100),
    resource_type VARCHAR(50),
    is_free BOOLEAN DEFAULT TRUE,
    duration_hours DECIMAL(5,1),
    difficulty VARCHAR(20),
    skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
    rating DECIMAL(2,1),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 9. LEARNING_PATHS TABLE
-- Personalized learning paths for users
CREATE TABLE IF NOT EXISTS learning_paths (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    target_job_id UUID REFERENCES job_roles(id),
    skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
    resource_id UUID REFERENCES learning_resources(id),
    step_order INTEGER,
    status VARCHAR(20) DEFAULT 'pending',
    estimated_hours DECIMAL(5,1),
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- SEED DATA: Skills
-- =============================================

INSERT INTO skills (name, category) VALUES
    ('JavaScript', 'language'),
    ('TypeScript', 'language'),
    ('Python', 'language'),
    ('Java', 'language'),
    ('C++', 'language'),
    ('C#', 'language'),
    ('Go', 'language'),
    ('Rust', 'language'),
    ('Ruby', 'language'),
    ('PHP', 'language'),
    ('Swift', 'language'),
    ('Kotlin', 'language'),
    ('React', 'framework'),
    ('Vue.js', 'framework'),
    ('Angular', 'framework'),
    ('Next.js', 'framework'),
    ('Node.js', 'framework'),
    ('Express.js', 'framework'),
    ('Django', 'framework'),
    ('Flask', 'framework'),
    ('Spring Boot', 'framework'),
    ('FastAPI', 'framework'),
    ('Ruby on Rails', 'framework'),
    ('Laravel', 'framework'),
    ('PostgreSQL', 'database'),
    ('MySQL', 'database'),
    ('MongoDB', 'database'),
    ('Redis', 'database'),
    ('SQLite', 'database'),
    ('Firebase', 'database'),
    ('Supabase', 'database'),
    ('Docker', 'tool'),
    ('Kubernetes', 'tool'),
    ('Git', 'tool'),
    ('GitHub Actions', 'tool'),
    ('Jenkins', 'tool'),
    ('Terraform', 'tool'),
    ('AWS', 'cloud'),
    ('Azure', 'cloud'),
    ('GCP', 'cloud'),
    ('Vercel', 'cloud'),
    ('Netlify', 'cloud'),
    ('REST API', 'concept'),
    ('GraphQL', 'concept'),
    ('CI/CD', 'concept'),
    ('Microservices', 'concept'),
    ('TDD', 'concept'),
    ('Agile', 'concept'),
    ('Machine Learning', 'concept'),
    ('Deep Learning', 'concept'),
    ('HTML', 'language'),
    ('CSS', 'language'),
    ('Sass', 'language'),
    ('Tailwind CSS', 'framework'),
    ('Bootstrap', 'framework'),
    ('Material UI', 'framework'),
    ('Redux', 'framework'),
    ('Webpack', 'tool'),
    ('Vite', 'tool'),
    ('npm', 'tool'),
    ('Linux', 'tool'),
    ('Bash', 'language')
ON CONFLICT (name) DO NOTHING;

-- =============================================
-- SEED DATA: Job Roles
-- =============================================

INSERT INTO job_roles (title, slug, description, experience_level, salary_range_min, salary_range_max, demand_score) VALUES
    ('Frontend Developer', 'frontend-developer', 'Build user interfaces for web applications using modern frameworks', 'entry', 50000, 80000, 85),
    ('Backend Developer', 'backend-developer', 'Build server-side applications, APIs, and databases', 'entry', 55000, 85000, 80),
    ('Full Stack Developer', 'fullstack-developer', 'Work on both frontend and backend of web applications', 'mid', 70000, 110000, 90),
    ('DevOps Engineer', 'devops-engineer', 'Manage infrastructure, CI/CD pipelines, and cloud deployments', 'mid', 80000, 130000, 75),
    ('Data Scientist', 'data-scientist', 'Analyze data and build machine learning models', 'mid', 90000, 140000, 70),
    ('Mobile Developer', 'mobile-developer', 'Build iOS and Android mobile applications', 'entry', 60000, 95000, 65),
    ('Cloud Architect', 'cloud-architect', 'Design and implement cloud infrastructure solutions', 'senior', 120000, 180000, 60),
    ('ML Engineer', 'ml-engineer', 'Build and deploy machine learning systems in production', 'mid', 100000, 160000, 75),
    ('React Developer', 'react-developer', 'Specialize in React.js frontend development', 'entry', 55000, 90000, 85),
    ('Node.js Developer', 'nodejs-developer', 'Build backend services using Node.js and Express', 'entry', 55000, 85000, 80),
    ('Python Developer', 'python-developer', 'Develop applications using Python for web, data, or automation', 'entry', 55000, 90000, 80),
    ('Site Reliability Engineer', 'sre', 'Ensure system reliability, scalability, and performance', 'senior', 110000, 170000, 65)
ON CONFLICT (slug) DO NOTHING;

-- =============================================
-- SEED DATA: Job Skills (linking skills to jobs)
-- =============================================

-- Frontend Developer skills
INSERT INTO job_skills (job_role_id, skill_id, importance, min_proficiency)
SELECT 
    (SELECT id FROM job_roles WHERE slug = 'frontend-developer'),
    id,
    CASE name
        WHEN 'JavaScript' THEN 'required'
        WHEN 'HTML' THEN 'required'
        WHEN 'CSS' THEN 'required'
        WHEN 'React' THEN 'required'
        WHEN 'TypeScript' THEN 'preferred'
        WHEN 'Git' THEN 'required'
        ELSE 'nice-to-have'
    END,
    CASE name
        WHEN 'JavaScript' THEN 'intermediate'
        WHEN 'React' THEN 'intermediate'
        ELSE 'beginner'
    END
FROM skills
WHERE name IN ('JavaScript', 'HTML', 'CSS', 'React', 'TypeScript', 'Git', 'REST API', 'Redux', 'Tailwind CSS')
ON CONFLICT DO NOTHING;

-- Backend Developer skills
INSERT INTO job_skills (job_role_id, skill_id, importance, min_proficiency)
SELECT 
    (SELECT id FROM job_roles WHERE slug = 'backend-developer'),
    id,
    CASE name
        WHEN 'Node.js' THEN 'required'
        WHEN 'Python' THEN 'required'
        WHEN 'PostgreSQL' THEN 'required'
        WHEN 'REST API' THEN 'required'
        WHEN 'Git' THEN 'required'
        WHEN 'Docker' THEN 'preferred'
        ELSE 'nice-to-have'
    END,
    'intermediate'
FROM skills
WHERE name IN ('Node.js', 'Python', 'PostgreSQL', 'REST API', 'Git', 'Docker', 'Express.js', 'MongoDB')
ON CONFLICT DO NOTHING;

-- Full Stack Developer skills
INSERT INTO job_skills (job_role_id, skill_id, importance, min_proficiency)
SELECT 
    (SELECT id FROM job_roles WHERE slug = 'fullstack-developer'),
    id,
    CASE name
        WHEN 'JavaScript' THEN 'required'
        WHEN 'React' THEN 'required'
        WHEN 'Node.js' THEN 'required'
        WHEN 'PostgreSQL' THEN 'required'
        WHEN 'Git' THEN 'required'
        ELSE 'preferred'
    END,
    'intermediate'
FROM skills
WHERE name IN ('JavaScript', 'React', 'Node.js', 'PostgreSQL', 'Git', 'TypeScript', 'Docker', 'REST API', 'MongoDB', 'Next.js')
ON CONFLICT DO NOTHING;

-- DevOps Engineer skills
INSERT INTO job_skills (job_role_id, skill_id, importance, min_proficiency)
SELECT 
    (SELECT id FROM job_roles WHERE slug = 'devops-engineer'),
    id,
    CASE name
        WHEN 'Docker' THEN 'required'
        WHEN 'Kubernetes' THEN 'required'
        WHEN 'AWS' THEN 'required'
        WHEN 'CI/CD' THEN 'required'
        WHEN 'Linux' THEN 'required'
        ELSE 'preferred'
    END,
    'intermediate'
FROM skills
WHERE name IN ('Docker', 'Kubernetes', 'AWS', 'CI/CD', 'Linux', 'Terraform', 'Git', 'Python', 'Bash', 'GitHub Actions')
ON CONFLICT DO NOTHING;

-- =============================================
-- CREATE INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_repositories_user_id ON repositories(user_id);
CREATE INDEX IF NOT EXISTS idx_user_skills_user_id ON user_skills(user_id);
CREATE INDEX IF NOT EXISTS idx_job_skills_job_id ON job_skills(job_role_id);
CREATE INDEX IF NOT EXISTS idx_learning_paths_user_id ON learning_paths(user_id);

-- =============================================
-- DONE!
-- =============================================
-- Verify by checking: SELECT COUNT(*) FROM skills;
-- Should return 62 skills
