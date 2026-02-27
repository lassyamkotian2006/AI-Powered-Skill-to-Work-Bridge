/**
 * Job Matching Routes
 * -------------------
 * API endpoints for job recommendations:
 * - GET /jobs/recommendations - Get personalized job matches
 * - GET /jobs/roles - List all available job roles
 * - GET /jobs/:slug - Get specific job details
 * - GET /jobs/gaps - Get skill gaps for top jobs
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const dbService = require('../services/supabaseService');
const jobMatcher = require('../services/jobMatcher');
const aiService = require('../services/ai');

const router = express.Router();

/**
 * GET /jobs/recommendations
 * Get personalized job recommendations based on user's skills
 */
router.get('/recommendations', requireAuth, async (req, res) => {
    try {
        // 1. Get user skills from database
        const dbUser = await dbService.getUserById(req.session.user.id);
        if (!dbUser) {
            console.error(`❌ Job Recommendations: User not found in database for session ID: ${req.session.user.id}`);
            return res.status(404).json({ error: 'User not found' });
        }

        const userSkills = await dbService.getUserSkills(dbUser.id);
        console.log(`📊 Job Recommendations: Found ${userSkills.length} skills for user ${dbUser.id}`);

        // 2. Get all available job roles
        let jobRoles = await dbService.getJobRoles();

        // If no roles in DB, or if roles have no skills (indicates broken/empty seed), use hardcoded ones as fallback
        const hasNoSkills = jobRoles && jobRoles.length > 0 && !jobRoles.some(r => r.job_skills && r.job_skills.length > 0);

        if (!jobRoles || jobRoles.length === 0 || hasNoSkills) {
            console.log(`⚠️ Job Recommendations: ${hasNoSkills ? 'DB roles found but no skills linked.' : 'No roles in DB.'} Using hardcoded fallback.`);
            jobRoles = jobMatcher.getHardcodedJobRoles();
        } else {
            console.log(`💼 Job Recommendations: Loaded ${jobRoles.length} job roles from database`);
        }

        // 3. Get interests from profile
        let userInterests = dbUser.interests || "";

        // 4. Calculate matches for all jobs
        const limit = parseInt(req.query.limit) || 10;
        const skillsForMatching = userSkills.map(s => ({
            name: s.skills?.name || s.name || 'Unknown Skill',
            level: s.proficiency_level || s.level || 'beginner',
            category: s.skills?.category || s.category || 'other'
        }));

        let topMatches = jobMatcher.getTopJobMatches(skillsForMatching, jobRoles, limit, userInterests);

        // Filter out 0% matches (e.g., jobs that don't match skills OR interests)
        topMatches = topMatches.filter(m => m.score > 0);

        // If still no matches after interest boost, provide a few default roles so the tab isn't empty
        if (topMatches.length === 0 && jobRoles.length > 0) {
            console.log("⚠️ No matches found even with interest boost. Showing top demand roles.");
            topMatches = jobRoles.slice(0, 3).map(role => {
                const match = jobMatcher.calculateJobMatch(skillsForMatching, role, userInterests);
                return {
                    jobTitle: role.title,
                    jobSlug: role.slug,
                    score: Math.max(match.score, 10), // Give a base score of 10% for visibility
                    fitLevel: 'low',
                    matchingSkills: [],
                    missingSkills: role.job_skills?.map(js => ({ name: js.skills?.name || js.name, importance: js.importance })) || [],
                    roadmap: { steps: [] }
                };
            });
        }

        // Get skill gaps
        const skillGaps = jobMatcher.getSkillGaps(topMatches);

        // 5. Get AI-powered role suggestions (non-blocking)
        let aiSuggestedRoles = [];
        try {
            const aiRoles = await aiService.suggestJobRolesWithAI(skillsForMatching, userInterests);
            if (aiRoles && Array.isArray(aiRoles)) {
                aiSuggestedRoles = aiRoles;
            }
        } catch (err) {
            console.warn('AI role suggestion skipped:', err.message);
        }

        console.log(`Found ${topMatches.length} job matches, ${aiSuggestedRoles.length} AI-suggested roles\n`);

        res.json({
            success: true,
            totalSkills: userSkills.length,
            aiSuggestedRoles,
            recommendations: topMatches.map(m => ({
                title: m.jobTitle,
                slug: m.jobSlug,
                score: m.score,
                fitLevel: m.fitLevel,
                experienceLevel: m.experienceLevel,
                salaryRange: m.salaryRange,
                matchingSkills: m.matchingSkills.map(s => s.name),
                missingSkills: m.missingSkills.map(s => ({
                    name: s.name,
                    importance: s.importance,
                    targetLevel: s.minLevel
                })),
                aiRecommendation: m.aiRecommendation
            })),
            skillGaps: skillGaps.slice(0, 10).map(g => ({
                skill: g.name,
                category: g.category,
                importance: g.importance,
                neededFor: g.neededFor
            }))
        });

    } catch (error) {
        console.error('❌ Job recommendations error:', error);
        res.status(500).json({
            error: 'Failed to get recommendations',
            message: error.message
        });
    }
});

/**
 * GET /jobs/roles
 * Get all available job roles
 */
router.get('/roles', async (req, res) => {
    try {
        const roles = await dbService.getJobRoles();

        res.json({
            success: true,
            count: roles.length,
            roles: roles.map(r => ({
                id: r.id,
                title: r.title,
                slug: r.slug,
                description: r.description,
                experienceLevel: r.experience_level,
                salaryRange: {
                    min: r.salary_range_min,
                    max: r.salary_range_max
                },
                demandScore: r.demand_score,
                requiredSkills: r.job_skills
                    ?.filter(js => js.importance === 'required')
                    .map(js => js.skills?.name) || []
            }))
        });

    } catch (error) {
        console.error('❌ Get roles error:', error);
        res.status(500).json({ error: 'Failed to get job roles' });
    }
});

/**
 * GET /jobs/:slug
 * Get detailed info about a specific job role
 */
router.get('/:slug', async (req, res) => {
    try {
        const role = await dbService.getJobRoleBySlug(req.params.slug);

        if (!role) {
            return res.status(404).json({ error: 'Job role not found' });
        }

        // Group skills by importance
        const skills = {
            required: [],
            preferred: [],
            niceToHave: []
        };

        for (const js of role.job_skills || []) {
            const skillInfo = {
                name: js.skills?.name,
                category: js.skills?.category,
                minLevel: js.min_proficiency
            };

            if (js.importance === 'required') skills.required.push(skillInfo);
            else if (js.importance === 'preferred') skills.preferred.push(skillInfo);
            else skills.niceToHave.push(skillInfo);
        }

        res.json({
            success: true,
            role: {
                id: role.id,
                title: role.title,
                slug: role.slug,
                description: role.description,
                experienceLevel: role.experience_level,
                salaryRange: {
                    min: role.salary_range_min,
                    max: role.salary_range_max
                },
                demandScore: role.demand_score,
                skills
            }
        });

    } catch (error) {
        res.status(500).json({ error: 'Failed to get job role' });
    }
});

/**
 * GET /jobs/career/path
 * Get career progression suggestions
 */
router.get('/career/path', requireAuth, async (req, res) => {
    try {
        const dbUser = await dbService.getUserById(req.session.user.id);
        if (!dbUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userSkills = await dbService.getUserSkills(dbUser.id);
        const jobRoles = await dbService.getJobRoles();

        const careerPath = jobMatcher.suggestCareerPath(
            userSkills.map(s => ({
                name: s.skills?.name,
                level: s.proficiency_level
            })),
            jobRoles
        );

        res.json({
            success: true,
            careerPath: {
                currentBestFit: careerPath.currentFit ? {
                    title: careerPath.currentFit.jobTitle,
                    score: careerPath.currentFit.score
                } : null,
                nextStep: careerPath.nextStep ? {
                    title: careerPath.nextStep.jobTitle,
                    score: careerPath.nextStep.score,
                    skillsNeeded: careerPath.skillsForNextLevel.map(s => s.name)
                } : null,
                longTermGoal: careerPath.longTermGoal ? {
                    title: careerPath.longTermGoal.jobTitle,
                    score: careerPath.longTermGoal.score
                } : null
            }
        });

    } catch (error) {
        res.status(500).json({ error: 'Failed to get career path' });
    }
});

module.exports = router;
