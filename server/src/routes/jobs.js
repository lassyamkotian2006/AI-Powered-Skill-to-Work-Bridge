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
        // Get user from database
        const dbUser = await dbService.getUserByGithubId(req.session.user.id);
        if (!dbUser) {
            return res.status(404).json({
                error: 'User not found',
                message: 'Please sync your data first: POST /skills/sync'
            });
        }

        // Get user's skills
        const userSkills = await dbService.getUserSkills(dbUser.id);
        if (userSkills.length === 0) {
            return res.status(400).json({
                error: 'No skills found',
                message: 'Please analyze your skills first: POST /skills/analyze'
            });
        }

        console.log(`💼 Generating job recommendations for ${req.session.user.login}`);
        console.log(`   User has ${userSkills.length} skills`);

        // Get all job roles
        const jobRoles = await dbService.getJobRoles();

        // Calculate top matches
        const limit = parseInt(req.query.limit) || 5;
        const topMatches = jobMatcher.getTopJobMatches(
            userSkills.map(s => ({
                name: s.skills?.name,
                level: s.proficiency_level,
                category: s.skills?.category
            })),
            jobRoles,
            limit
        );

        // Generate AI recommendation for top match
        if (topMatches.length > 0 && topMatches[0].score > 30) {
            try {
                topMatches[0].aiRecommendation = await aiService.generateJobRecommendation(
                    userSkills.map(s => ({
                        name: s.skills?.name,
                        level: s.proficiency_level
                    })),
                    { title: topMatches[0].jobTitle }
                );
            } catch (aiError) {
                console.log('AI recommendation skipped:', aiError.message);
            }
        }

        // Get skill gaps
        const skillGaps = jobMatcher.getSkillGaps(topMatches);

        // Save matches to database
        try {
            await dbService.saveJobMatches(dbUser.id, topMatches);
        } catch (saveError) {
            console.log('Job match save skipped:', saveError.message);
        }

        console.log(`✅ Found ${topMatches.length} job matches\n`);

        res.json({
            success: true,
            totalSkills: userSkills.length,
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
        const dbUser = await dbService.getUserByGithubId(req.session.user.id);
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
