-- Add non-developer roles to job_roles
INSERT INTO job_roles (title, slug, description, experience_level, salary_range_min, salary_range_max, demand_score) VALUES
    ('UI/UX Designer', 'ui-ux-designer', 'Design user experiences and interfaces for digital products', 'entry', 50000, 90000, 75),
    ('Data Analyst', 'data-analyst', 'Analyze data sets to identify trends and provide actionable insights', 'entry', 50000, 85000, 80),
    ('Product Manager', 'product-manager', 'Lead the product strategy and roadmap for technical products', 'mid', 90000, 150000, 70),
    ('QA Engineer', 'qa-engineer', 'Ensure software quality through manual and automated testing', 'entry', 55000, 90000, 75),
    ('Technical Writer', 'technical-writer', 'Create clear and concise documentation for technical products', 'entry', 50000, 85000, 65),
    ('Cybersecurity Analyst', 'cybersecurity-analyst', 'Protect organizations from security threats and vulnerabilities', 'entry', 65000, 110000, 85)
ON CONFLICT (slug) DO NOTHING;

-- Add skills for new roles
INSERT INTO skills (name, category) VALUES
    ('Figma', 'tool'),
    ('Design Systems', 'concept'),
    ('Tableau', 'tool'),
    ('Data Visualization', 'concept'),
    ('Excel', 'tool'),
    ('Product Roadmap', 'concept'),
    ('Market Research', 'concept'),
    ('Jira', 'tool'),
    ('Automation Testing', 'concept'),
    ('Selenium', 'tool'),
    ('Bug Tracking', 'concept'),
    ('Technical Writing', 'concept'),
    ('Documentation Tools', 'tool'),
    ('Network Security', 'concept'),
    ('Penetration Testing', 'concept'),
    ('Threat Analysis', 'concept'),
    ('Penetration Testing', 'concept'),
    ('Selenium', 'tool'),
    ('Automation Testing', 'concept'),
    ('Selenium', 'tool')
ON CONFLICT (name) DO NOTHING;

-- Link skills to UI/UX Designer
INSERT INTO job_skills (job_role_id, skill_id, importance, min_proficiency)
SELECT (SELECT id FROM job_roles WHERE slug = 'ui-ux-designer'), id, 'required', 'intermediate'
FROM skills WHERE name IN ('Figma', 'Design Systems', 'HTML', 'CSS');

-- Link skills to Data Analyst
INSERT INTO job_skills (job_role_id, skill_id, importance, min_proficiency)
SELECT (SELECT id FROM job_roles WHERE slug = 'data-analyst'), id, 'required', 'intermediate'
FROM skills WHERE name IN ('Python', 'PostgreSQL', 'Excel', 'Data Visualization');

-- Link skills to Technical Writer
INSERT INTO job_skills (job_role_id, skill_id, importance, min_proficiency)
SELECT (SELECT id FROM job_roles WHERE slug = 'technical-writer'), id, 'required', 'intermediate'
FROM skills WHERE name IN ('Technical Writing', 'Markdown', 'Git');
