/**
 * Job Matching Routes
 * -------------------
 * API endpoints for job recommendations:
 * - POST /jobs/generate-matches - AI-powered job matching via Groq
 * - GET /jobs/roles - List all available job roles
 * - GET /jobs/:slug - Get specific job details
 * - GET /jobs/career/path - Career progression suggestions
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const dbService = require('../services/supabaseService');
const jobMatcher = require('../services/jobMatcher');
const { generateJobMatches } = require('../controllers/jobMatchController');

const router = express.Router();

/**
 * POST /jobs/generate-matches
 * AI-powered job matching using Groq LLaMA
 * Accepts: { skills: string[], interest: string }
 * Returns: { domain: string, roles: string[] }
 */
router.post('/generate-matches', requireAuth, generateJobMatches);

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
        console.error('Get roles error:', error);
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

/**
 * POST /jobs/goal
 * Save a custom career goal
 */
router.post('/goal', requireAuth, async (req, res) => {
    try {
        const { goal } = req.body;

        if (!goal) {
            return res.status(400).json({
                success: false,
                error: 'Goal required'
            });
        }

        // Save to database
        await dbService.updateUserTargetRole(req.session.user.id, goal);

        // Update session
        req.session.user.targetRole = goal;

        res.json({
            success: true,
            goal
        });

    } catch (err) {
        console.error('Goal save error:', err);
        res.status(500).json({
            success: false,
            error: 'Failed to save career goal'
        });
    }
});

module.exports = router;
