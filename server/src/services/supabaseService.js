/**
 * Supabase Database Service
 * -------------------------
 * Handles all database operations for the Skill-to-Work Bridge.
 * 
 * Tables used:
 * - users: GitHub user info
 * - repositories: User's repos
 * - skills: Master skill list
 * - user_skills: Skills extracted from user's repos
 * - job_roles: Available job positions
 * - job_skills: Skills required for each job
 * - user_job_matches: Job recommendations
 * - learning_resources: Courses and tutorials
 * - learning_paths: User's personalized learning plan
 */

const supabase = require('../config/supabase');

// =============================================
// USER OPERATIONS
// =============================================

/**
 * Save or update user after GitHub OAuth login
 * @param {Object} githubUser - User data from GitHub API
 * @param {string} accessToken - GitHub OAuth access token
 * @returns {Object} Saved user record
 */
async function saveUser(githubUser, accessToken) {
    if (!supabase) throw new Error('Database not configured');

    const { data, error } = await supabase
        .from('users')
        .upsert({
            github_id: githubUser.id,
            username: githubUser.login,
            name: githubUser.name,
            avatar_url: githubUser.avatar_url,
            profile_url: githubUser.html_url,
            access_token: accessToken,
            updated_at: new Date().toISOString()
        }, { onConflict: 'github_id' })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Get user by GitHub ID
 */
async function getUserByGithubId(githubId) {
    if (!supabase) return null;

    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('github_id', githubId)
        .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
}

/**
 * Get user by email
 */
async function getUserByEmail(email) {
    if (!supabase) return null;

    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
}

/**
 * Create a new user with email and password
 */
async function createUser(email, passwordHash, username) {
    if (!supabase) throw new Error('Database not configured');

    const { data, error } = await supabase
        .from('users')
        .insert({
            email,
            password_hash: passwordHash,
            username: username || email.split('@')[0],
            is_email_verified: false
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Update user verification status
 */
async function updateUserVerification(userId, isVerified) {
    if (!supabase) throw new Error('Database not configured');

    const { error } = await supabase
        .from('users')
        .update({ is_email_verified: isVerified })
        .eq('id', userId);

    if (error) throw error;
    return true;
}

/**
 * Update user password
 */
async function updateUserPassword(userId, passwordHash) {
    if (!supabase) throw new Error('Database not configured');

    const { data, error } = await supabase
        .from('users')
        .update({ password_hash: passwordHash })
        .eq('id', userId);

    if (error) throw error;
    return { data };
}

/**
 * Update user interests
 */
async function updateUserInterests(userId, interests) {
    if (!supabase) throw new Error('Database not configured');

    const { data, error } = await supabase
        .from('users')
        .update({ interests: interests })
        .eq('id', userId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Update user target role
 */
async function updateUserTargetRole(userId, targetRole) {
    if (!supabase) throw new Error('Database not configured');

    const { data, error } = await supabase
        .from('users')
        .update({ target_role: targetRole })
        .eq('id', userId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Link GitHub account to an existing user
 */
async function linkGitHubAccount(userId, githubUser, accessToken) {
    if (!supabase) throw new Error('Database not configured');

    const { data, error } = await supabase
        .from('users')
        .update({
            github_id: githubUser.id,
            avatar_url: githubUser.avatar_url,
            profile_url: githubUser.html_url,
            access_token: accessToken,
            updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

// =============================================
// REPOSITORY OPERATIONS
// =============================================

/**
 * Save repositories to database
 * @param {string} userId - Database user ID (UUID)
 * @param {Array} repos - Repositories from GitHub API
 */
async function saveRepositories(userId, repos) {
    if (!supabase) throw new Error('Database not configured');

    const repoData = repos.map(repo => ({
        user_id: userId,
        github_repo_id: repo.id,
        name: repo.name,
        full_name: repo.fullName,
        description: repo.description,
        url: repo.url,
        languages: repo.languages || {},
        is_private: repo.isPrivate,
        stars: repo.stars,
        forks: repo.forks
    }));

    const { data, error } = await supabase
        .from('repositories')
        .upsert(repoData, { onConflict: 'user_id,github_repo_id' })
        .select();

    if (error) throw error;
    return data;
}

/**
 * Get user's repositories from database
 */
async function getUserRepositories(userId) {
    if (!supabase) return [];

    const { data, error } = await supabase
        .from('repositories')
        .select('*')
        .eq('user_id', userId)
        .order('stars', { ascending: false });

    if (error) throw error;
    return data;
}

// =============================================
// SKILL OPERATIONS
// =============================================

/**
 * Get all skills from master list
 */
async function getAllSkills() {
    if (!supabase) return [];

    const { data, error } = await supabase
        .from('skills')
        .select('*')
        .order('name');

    if (error) throw error;
    return data;
}

/**
 * Get skill by name (case insensitive)
 */
async function getSkillByName(name) {
    if (!supabase) return null;

    const { data, error } = await supabase
        .from('skills')
        .select('*')
        .ilike('name', name)
        .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
}

/**
 * Add a new skill to the database
 */
async function addSkill(name, category) {
    if (!supabase) throw new Error('Database not configured');

    const { data, error } = await supabase
        .from('skills')
        .insert({ name, category })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Save user's extracted skills
 * @param {string} userId - Database user ID
 * @param {Array} skills - Skills with proficiency levels
 */
async function saveUserSkills(userId, skills) {
    if (!supabase) throw new Error('Database not configured');

    const skillData = skills.map(skill => ({
        user_id: userId,
        skill_id: skill.skillId,
        proficiency_level: skill.level,
        confidence_score: skill.confidence,
        repo_count: skill.repoCount || 1,
        evidence: skill.evidence || [],
        updated_at: new Date().toISOString()
    }));

    const { data, error } = await supabase
        .from('user_skills')
        .upsert(skillData, { onConflict: 'user_id,skill_id' })
        .select();

    if (error) throw error;
    return data;
}

/**
 * Get user's skills with skill details
 */
async function getUserSkills(userId) {
    if (!supabase) return [];

    const { data, error } = await supabase
        .from('user_skills')
        .select(`
            *,
            skills (id, name, category)
        `)
        .eq('user_id', userId)
        .order('confidence_score', { ascending: false });

    if (error) throw error;
    return data;
}

// =============================================
// JOB ROLE OPERATIONS
// =============================================

/**
 * Get all job roles with their required skills
 */
async function getJobRoles() {
    if (!supabase) return [];

    const { data, error } = await supabase
        .from('job_roles')
        .select(`
            *,
            job_skills (
                importance,
                min_proficiency,
                skills (id, name, category)
            )
        `)
        .order('demand_score', { ascending: false });

    if (error) throw error;
    return data;
}

/**
 * Get a specific job role by slug
 */
async function getJobRoleBySlug(slug) {
    if (!supabase) return null;

    const { data, error } = await supabase
        .from('job_roles')
        .select(`
            *,
            job_skills (
                importance,
                min_proficiency,
                skills (id, name, category)
            )
        `)
        .eq('slug', slug)
        .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
}

/**
 * Save job match recommendations for a user
 */
async function saveJobMatches(userId, matches) {
    if (!supabase) throw new Error('Database not configured');

    const matchData = matches.map(match => ({
        user_id: userId,
        job_role_id: match.jobId,
        match_score: match.score,
        matching_skills: match.matchingSkills,
        missing_skills: match.missingSkills,
        recommendation_text: match.recommendation
    }));

    const { data, error } = await supabase
        .from('user_job_matches')
        .upsert(matchData, { onConflict: 'user_id,job_role_id' })
        .select();

    if (error) throw error;
    return data;
}

/**
 * Get user's job matches
 */
async function getUserJobMatches(userId) {
    if (!supabase) return [];

    const { data, error } = await supabase
        .from('user_job_matches')
        .select(`
            *,
            job_roles (id, title, slug, experience_level, salary_range_min, salary_range_max)
        `)
        .eq('user_id', userId)
        .order('match_score', { ascending: false });

    if (error) throw error;
    return data;
}

// =============================================
// LEARNING RESOURCE OPERATIONS
// =============================================

/**
 * Get learning resources for a specific skill
 */
async function getLearningResources(skillId, freeOnly = true) {
    if (!supabase) return [];

    let query = supabase
        .from('learning_resources')
        .select('*')
        .eq('skill_id', skillId)
        .order('rating', { ascending: false });

    if (freeOnly) {
        query = query.eq('is_free', true);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
}

/**
 * Add a learning resource
 */
async function addLearningResource(resource) {
    if (!supabase) throw new Error('Database not configured');

    const { data, error } = await supabase
        .from('learning_resources')
        .insert(resource)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Save learning path for a user
 */
async function saveLearningPath(userId, pathItems) {
    if (!supabase) throw new Error('Database not configured');

    const { data, error } = await supabase
        .from('learning_paths')
        .insert(pathItems.map((item, index) => ({
            user_id: userId,
            target_job_id: item.targetJobId,
            skill_id: item.skillId,
            resource_id: item.resourceId,
            step_order: index + 1,
            estimated_hours: item.estimatedHours
        })))
        .select();

    if (error) throw error;
    return data;
}

/**
 * Get user's learning path
 */
async function getUserLearningPath(userId) {
    if (!supabase) return [];

    const { data, error } = await supabase
        .from('learning_paths')
        .select(`
            *,
            skills (id, name, category),
            learning_resources (id, title, url, platform, resource_type, duration_hours),
            job_roles (id, title)
        `)
        .eq('user_id', userId)
        .order('step_order');

    if (error) throw error;
    return data;
}

// =============================================
// EXPORTS
// =============================================

module.exports = {
    // User operations
    saveUser,
    getUserByGithubId,
    getUserByEmail,
    createUser,
    updateUserVerification,
    updateUserPassword,
    updateUserInterests,
    updateUserTargetRole,
    linkGitHubAccount,

    // Repository operations
    saveRepositories,
    getUserRepositories,

    // Skill operations
    getAllSkills,
    getSkillByName,
    addSkill,
    saveUserSkills,
    getUserSkills,

    // Job role operations
    getJobRoles,
    getJobRoleBySlug,
    saveJobMatches,
    getUserJobMatches,

    // Learning operations
    getLearningResources,
    addLearningResource,
    saveLearningPath,
    getUserLearningPath
};
