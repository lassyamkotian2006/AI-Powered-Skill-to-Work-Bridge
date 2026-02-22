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
// 3. Get interests from profile
let userInterests = "";
try {
    const dbUser = await dbService.getUserByGithubId(req.session.user.id);
    if (dbUser) {
        userInterests = dbUser.interests || "";
    }
} catch (dbError) {
    console.log('Interests lookup skipped');
}

// 4. Calculate matches for all jobs
const limit = parseInt(req.query.limit) || 10;
const skillsForMatching = userSkills.map(s => ({
    name: s.skills?.name || s.name || 'Unknown Skill',
    level: s.proficiency_level || s.level || 'beginner',
    category: s.skills?.category || s.category || 'other'
}));

let topMatches = jobMatcher.getTopJobMatches(skillsForMatching, jobRoles, limit, userInterests);

// Filter out 0% matches if the user has no skills or if they are just dummy placeholders
if (skillsForMatching.length === 0) {
    topMatches = [];
} else {
    topMatches = topMatches.filter(m => m.score > 0);
}

// Get skill gaps
const skillGaps = jobMatcher.getSkillGaps(topMatches);

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
 * Hardcoded job roles for when database is not available
 */
function getHardcodedJobRoles() {
    return [
        {
            id: '1', title: 'Frontend Developer', slug: 'frontend-developer',
            experience_level: 'entry', salary_range_min: 50000, salary_range_max: 80000, demand_score: 85,
            job_skills: [
                { importance: 'required', min_proficiency: 'intermediate', skills: { name: 'JavaScript', category: 'language' } },
                { importance: 'required', min_proficiency: 'intermediate', skills: { name: 'React', category: 'framework' } },
                { importance: 'required', min_proficiency: 'beginner', skills: { name: 'HTML', category: 'language' } },
                { importance: 'required', min_proficiency: 'beginner', skills: { name: 'CSS', category: 'language' } },
                { importance: 'preferred', min_proficiency: 'intermediate', skills: { name: 'TypeScript', category: 'language' } },
                { importance: 'required', min_proficiency: 'beginner', skills: { name: 'Git', category: 'tool' } }
            ]
        },
        {
            id: '2', title: 'Backend Developer', slug: 'backend-developer',
            experience_level: 'entry', salary_range_min: 55000, salary_range_max: 85000, demand_score: 80,
            job_skills: [
                { importance: 'required', min_proficiency: 'intermediate', skills: { name: 'Node.js', category: 'framework' } },
                { importance: 'required', min_proficiency: 'intermediate', skills: { name: 'PostgreSQL', category: 'database' } },
                { importance: 'required', min_proficiency: 'intermediate', skills: { name: 'REST API', category: 'concept' } },
                { importance: 'preferred', min_proficiency: 'intermediate', skills: { name: 'Docker', category: 'tool' } },
                { importance: 'required', min_proficiency: 'beginner', skills: { name: 'Git', category: 'tool' } }
            ]
        },
        {
            id: '3', title: 'Full Stack Developer', slug: 'fullstack-developer',
            experience_level: 'mid', salary_range_min: 70000, salary_range_max: 110000, demand_score: 90,
            job_skills: [
                { importance: 'required', min_proficiency: 'intermediate', skills: { name: 'JavaScript', category: 'language' } },
                { importance: 'required', min_proficiency: 'intermediate', skills: { name: 'React', category: 'framework' } },
                { importance: 'required', min_proficiency: 'intermediate', skills: { name: 'Node.js', category: 'framework' } },
                { importance: 'required', min_proficiency: 'intermediate', skills: { name: 'PostgreSQL', category: 'database' } },
                { importance: 'preferred', min_proficiency: 'intermediate', skills: { name: 'TypeScript', category: 'language' } },
                { importance: 'preferred', min_proficiency: 'intermediate', skills: { name: 'Docker', category: 'tool' } },
                { importance: 'required', min_proficiency: 'beginner', skills: { name: 'Git', category: 'tool' } }
            ]
        },
        {
            id: '4', title: 'React Developer', slug: 'react-developer',
            experience_level: 'entry', salary_range_min: 55000, salary_range_max: 90000, demand_score: 85,
            job_skills: [
                { importance: 'required', min_proficiency: 'advanced', skills: { name: 'React', category: 'framework' } },
                { importance: 'required', min_proficiency: 'intermediate', skills: { name: 'JavaScript', category: 'language' } },
                { importance: 'required', min_proficiency: 'beginner', skills: { name: 'HTML', category: 'language' } },
                { importance: 'required', min_proficiency: 'beginner', skills: { name: 'CSS', category: 'language' } },
                { importance: 'preferred', min_proficiency: 'intermediate', skills: { name: 'TypeScript', category: 'language' } },
                { importance: 'preferred', min_proficiency: 'intermediate', skills: { name: 'Redux', category: 'framework' } }
            ]
        },
        {
            id: '5', title: 'Node.js Developer', slug: 'nodejs-developer',
            experience_level: 'entry', salary_range_min: 55000, salary_range_max: 85000, demand_score: 80,
            job_skills: [
                { importance: 'required', min_proficiency: 'advanced', skills: { name: 'Node.js', category: 'framework' } },
                { importance: 'required', min_proficiency: 'intermediate', skills: { name: 'JavaScript', category: 'language' } },
                { importance: 'required', min_proficiency: 'intermediate', skills: { name: 'Express.js', category: 'framework' } },
                { importance: 'required', min_proficiency: 'intermediate', skills: { name: 'PostgreSQL', category: 'database' } },
                { importance: 'preferred', min_proficiency: 'intermediate', skills: { name: 'MongoDB', category: 'database' } }
            ]
        },
        {
            id: '6', title: 'DevOps Engineer', slug: 'devops-engineer',
            experience_level: 'mid', salary_range_min: 80000, salary_range_max: 130000, demand_score: 75,
            job_skills: [
                { importance: 'required', min_proficiency: 'intermediate', skills: { name: 'Docker', category: 'tool' } },
                { importance: 'required', min_proficiency: 'intermediate', skills: { name: 'Kubernetes', category: 'tool' } },
                { importance: 'required', min_proficiency: 'intermediate', skills: { name: 'AWS', category: 'cloud' } },
                { importance: 'required', min_proficiency: 'intermediate', skills: { name: 'CI/CD', category: 'concept' } },
                { importance: 'required', min_proficiency: 'intermediate', skills: { name: 'Linux', category: 'tool' } },
                { importance: 'preferred', min_proficiency: 'intermediate', skills: { name: 'Python', category: 'language' } }
            ]
        },
        {
            id: '7', title: 'Python Developer', slug: 'python-developer',
            experience_level: 'entry', salary_range_min: 55000, salary_range_max: 90000, demand_score: 80,
            job_skills: [
                { importance: 'required', min_proficiency: 'intermediate', skills: { name: 'Python', category: 'language' } },
                { importance: 'preferred', min_proficiency: 'intermediate', skills: { name: 'Django', category: 'framework' } },
                { importance: 'preferred', min_proficiency: 'intermediate', skills: { name: 'Flask', category: 'framework' } },
                { importance: 'required', min_proficiency: 'intermediate', skills: { name: 'PostgreSQL', category: 'database' } },
                { importance: 'preferred', min_proficiency: 'beginner', skills: { name: 'Docker', category: 'tool' } }
            ]
        },
        {
            id: '8', title: 'Data Scientist', slug: 'data-scientist',
            experience_level: 'mid', salary_range_min: 90000, salary_range_max: 140000, demand_score: 70,
            job_skills: [
                { importance: 'required', min_proficiency: 'advanced', skills: { name: 'Python', category: 'language' } },
                { importance: 'required', min_proficiency: 'intermediate', skills: { name: 'Machine Learning', category: 'concept' } },
                { importance: 'required', min_proficiency: 'intermediate', skills: { name: 'PostgreSQL', category: 'database' } },
                { importance: 'preferred', min_proficiency: 'intermediate', skills: { name: 'Deep Learning', category: 'concept' } }
            ]
        },
        {
            id: '9', title: 'UI/UX Designer', slug: 'ui-ux-designer',
            experience_level: 'entry', salary_range_min: 50000, salary_range_max: 90000, demand_score: 75,
            job_skills: [
                { importance: 'required', min_proficiency: 'intermediate', skills: { name: 'Figma', category: 'tool' } },
                { importance: 'required', min_proficiency: 'beginner', skills: { name: 'HTML', category: 'language' } },
                { importance: 'required', min_proficiency: 'beginner', skills: { name: 'CSS', category: 'language' } },
                { importance: 'preferred', min_proficiency: 'beginner', skills: { name: 'React', category: 'framework' } },
                { importance: 'required', min_proficiency: 'intermediate', skills: { name: 'Design Systems', category: 'concept' } }
            ]
        },
        {
            id: '10', title: 'Data Analyst', slug: 'data-analyst',
            experience_level: 'entry', salary_range_min: 50000, salary_range_max: 85000, demand_score: 80,
            job_skills: [
                { importance: 'required', min_proficiency: 'intermediate', skills: { name: 'Python', category: 'language' } },
                { importance: 'required', min_proficiency: 'intermediate', skills: { name: 'PostgreSQL', category: 'database' } },
                { importance: 'required', min_proficiency: 'intermediate', skills: { name: 'Excel', category: 'tool' } },
                { importance: 'preferred', min_proficiency: 'beginner', skills: { name: 'Tableau', category: 'tool' } },
                { importance: 'required', min_proficiency: 'intermediate', skills: { name: 'Data Visualization', category: 'concept' } }
            ]
        },
        {
            id: '11', title: 'Product Manager', slug: 'product-manager',
            experience_level: 'mid', salary_range_min: 90000, salary_range_max: 150000, demand_score: 70,
            job_skills: [
                { importance: 'required', min_proficiency: 'intermediate', skills: { name: 'Agile', category: 'concept' } },
                { importance: 'required', min_proficiency: 'intermediate', skills: { name: 'Product Roadmap', category: 'concept' } },
                { importance: 'preferred', min_proficiency: 'beginner', skills: { name: 'SQL', category: 'language' } },
                { importance: 'required', min_proficiency: 'intermediate', skills: { name: 'Market Research', category: 'concept' } },
                { importance: 'required', min_proficiency: 'intermediate', skills: { name: 'Jira', category: 'tool' } }
            ]
        },
        {
            id: '12', title: 'Quality Assurance Engineer', slug: 'qa-engineer',
            experience_level: 'entry', salary_range_min: 55000, salary_range_max: 90000, demand_score: 75,
            job_skills: [
                { importance: 'required', min_proficiency: 'intermediate', skills: { name: 'Automation Testing', category: 'concept' } },
                { importance: 'required', min_proficiency: 'intermediate', skills: { name: 'Selenium', category: 'tool' } },
                { importance: 'required', min_proficiency: 'beginner', skills: { name: 'JavaScript', category: 'language' } },
                { importance: 'preferred', min_proficiency: 'beginner', skills: { name: 'Jest', category: 'framework' } },
                { importance: 'required', min_proficiency: 'intermediate', skills: { name: 'Bug Tracking', category: 'concept' } }
            ]
        },
        {
            id: '13', title: 'Technical Writer', slug: 'technical-writer',
            experience_level: 'entry', salary_range_min: 50000, salary_range_max: 85000, demand_score: 65,
            job_skills: [
                { importance: 'required', min_proficiency: 'advanced', skills: { name: 'Technical Writing', category: 'concept' } },
                { importance: 'required', min_proficiency: 'intermediate', skills: { name: 'Markdown', category: 'language' } },
                { importance: 'required', min_proficiency: 'beginner', skills: { name: 'Git', category: 'tool' } },
                { importance: 'preferred', min_proficiency: 'beginner', skills: { name: 'REST API', category: 'concept' } },
                { importance: 'required', min_proficiency: 'intermediate', skills: { name: 'Documentation Tools', category: 'tool' } }
            ]
        },
        {
            id: '14', title: 'Cybersecurity Analyst', slug: 'cybersecurity-analyst',
            experience_level: 'entry', salary_range_min: 65000, salary_range_max: 110000, demand_score: 85,
            job_skills: [
                { importance: 'required', min_proficiency: 'intermediate', skills: { name: 'Network Security', category: 'concept' } },
                { importance: 'required', min_proficiency: 'intermediate', skills: { name: 'Penetration Testing', category: 'concept' } },
                { importance: 'required', min_proficiency: 'beginner', skills: { name: 'Python', category: 'language' } },
                { importance: 'preferred', min_proficiency: 'beginner', skills: { name: 'Linux', category: 'tool' } },
                { importance: 'required', min_proficiency: 'intermediate', skills: { name: 'Threat Analysis', category: 'concept' } }
            ]
        }
    ];
}

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
