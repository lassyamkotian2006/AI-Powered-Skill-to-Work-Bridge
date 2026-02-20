/**
 * Learning Path Routes
 * --------------------
 * API endpoints for personalized learning recommendations:
 * - GET /learning/path - Get personalized learning path
 * - GET /learning/resources/:skillName - Get resources for a skill
 * - GET /learning/roadmap - Get complete learning roadmap
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const dbService = require('../services/supabaseService');
const jobMatcher = require('../services/jobMatcher');
const aiService = require('../services/ai');

const router = express.Router();

/**
 * GET /learning/path
 * Generate personalized learning path based on skill gaps
 */
router.get('/path', requireAuth, async (req, res) => {
    try {
        console.log(`📚 Generating learning path for ${req.session.user.login}`);

        // Try to get user skills from database first
        let userSkills = [];
        try {
            const dbUser = await dbService.getUserByGithubId(req.session.user.id);
            if (dbUser) {
                userSkills = await dbService.getUserSkills(dbUser.id);
            }
        } catch (dbError) {
            console.log('Database lookup skipped:', dbError.message);
        }

        // If no database skills, use session skills if available
        if (userSkills.length === 0 && req.session.extractedSkills) {
            userSkills = req.session.extractedSkills.map(s => ({
                skills: { name: s.name, category: s.category },
                proficiency_level: s.level
            }));
        }

        console.log(`   User has ${userSkills.length} skills`);

        // Get job roles (try database first, then use hardcoded)
        let jobRoles = [];
        try {
            jobRoles = await dbService.getJobRoles();
        } catch (dbError) {
            console.log('Using hardcoded job roles');
        }

        // If no job roles from database, use hardcoded ones
        if (jobRoles.length === 0) {
            jobRoles = getHardcodedJobRoles();
        }

        // Get job matches and skill gaps
        const skillsForMatching = userSkills.map(s => ({
            name: s.skills?.name || s.name,
            level: s.proficiency_level || s.level
        }));

        const topMatches = jobMatcher.getTopJobMatches(skillsForMatching, jobRoles, 5);
        const skillGaps = jobMatcher.getSkillGaps(topMatches);

        // Build learning path for each skill gap
        const learningPath = [];
        let totalHours = 0;

        for (const gap of skillGaps.slice(0, 8)) {
            const estimatedHours = getEstimatedHours(gap.minLevel);
            totalHours += estimatedHours;

            learningPath.push({
                skill: gap.name,
                category: gap.category,
                currentLevel: 'beginner',
                targetLevel: gap.minLevel || 'intermediate',
                importance: gap.importance,
                neededFor: gap.neededFor,
                estimatedHours,
                resources: getDefaultResources(gap.name)
            });
        }

        console.log(`✅ Generated learning path with ${learningPath.length} skills to learn\n`);

        res.json({
            success: true,
            message: 'Learning path generated',
            summary: {
                skillsToLearn: learningPath.length,
                estimatedTotalHours: totalHours,
                estimatedWeeks: Math.ceil(totalHours / 10),
                targetJobs: topMatches.slice(0, 3).map(m => m.jobTitle)
            },
            learningPath
        });

    } catch (error) {
        console.error('❌ Learning path error:', error);
        res.status(500).json({ error: 'Failed to generate learning path', message: error.message });
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
            id: '5', title: 'DevOps Engineer', slug: 'devops-engineer',
            experience_level: 'mid', salary_range_min: 80000, salary_range_max: 130000, demand_score: 75,
            job_skills: [
                { importance: 'required', min_proficiency: 'intermediate', skills: { name: 'Docker', category: 'tool' } },
                { importance: 'required', min_proficiency: 'intermediate', skills: { name: 'Kubernetes', category: 'tool' } },
                { importance: 'required', min_proficiency: 'intermediate', skills: { name: 'AWS', category: 'cloud' } },
                { importance: 'required', min_proficiency: 'intermediate', skills: { name: 'CI/CD', category: 'concept' } },
                { importance: 'required', min_proficiency: 'intermediate', skills: { name: 'Linux', category: 'tool' } }
            ]
        }
    ];
}

/**
 * GET /learning/resources/:skillName
 * Get learning resources for a specific skill
 */
router.get('/resources/:skillName', async (req, res) => {
    try {
        const skillName = req.params.skillName;
        const allSkills = await dbService.getAllSkills();

        const skill = allSkills.find(
            s => s.name.toLowerCase() === skillName.toLowerCase()
        );

        if (!skill) {
            // Return default resources if skill not in database
            return res.json({
                success: true,
                skill: skillName,
                resources: getDefaultResources(skillName)
            });
        }

        const resources = await dbService.getLearningResources(skill.id);

        res.json({
            success: true,
            skill: skill.name,
            category: skill.category,
            resources: resources.length > 0
                ? formatResources(resources)
                : getDefaultResources(skillName)
        });

    } catch (error) {
        res.status(500).json({ error: 'Failed to get resources' });
    }
});

/**
 * GET /learning/roadmap
 * Get a complete learning roadmap with milestones
 */
router.get('/roadmap', requireAuth, async (req, res) => {
    try {
        const dbUser = await dbService.getUserByGithubId(req.session.user.id);
        if (!dbUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userSkills = await dbService.getUserSkills(dbUser.id);
        const jobRoles = await dbService.getJobRoles();

        // Get career path
        const careerPath = jobMatcher.suggestCareerPath(
            userSkills.map(s => ({ name: s.skills?.name, level: s.proficiency_level })),
            jobRoles
        );

        // Build roadmap with milestones
        const roadmap = {
            currentPosition: {
                skills: userSkills.slice(0, 10).map(s => ({
                    name: s.skills?.name,
                    level: s.proficiency_level
                })),
                bestFit: careerPath.currentFit?.jobTitle,
                fitScore: careerPath.currentFit?.score
            },
            milestones: []
        };

        // Milestone 1: Fill required skill gaps (1-3 months)
        if (careerPath.currentFit?.missingSkills?.length > 0) {
            roadmap.milestones.push({
                title: 'Foundation Building',
                timeframe: '1-3 months',
                goal: `Become job-ready for ${careerPath.currentFit.jobTitle}`,
                skills: careerPath.currentFit.missingSkills.slice(0, 3).map(s => s.name),
                focus: 'Learn fundamentals and build small projects'
            });
        }

        // Milestone 2: Level up current skills (3-6 months)
        const intermediateSkills = userSkills
            .filter(s => s.proficiency_level === 'beginner')
            .slice(0, 3);

        if (intermediateSkills.length > 0) {
            roadmap.milestones.push({
                title: 'Skill Enhancement',
                timeframe: '3-6 months',
                goal: 'Advance from beginner to intermediate level',
                skills: intermediateSkills.map(s => s.skills?.name),
                focus: 'Build portfolio projects and contribute to open source'
            });
        }

        // Milestone 3: Career advancement (6-12 months)
        if (careerPath.nextStep) {
            roadmap.milestones.push({
                title: 'Career Advancement',
                timeframe: '6-12 months',
                goal: `Prepare for ${careerPath.nextStep.jobTitle}`,
                skills: careerPath.skillsForNextLevel?.slice(0, 4).map(s => s.name) || [],
                focus: 'Master advanced concepts and specialize'
            });
        }

        // Milestone 4: Long-term goal (1-2 years)
        if (careerPath.longTermGoal) {
            roadmap.milestones.push({
                title: 'Expert Level',
                timeframe: '1-2 years',
                goal: `Achieve ${careerPath.longTermGoal.jobTitle} status`,
                skills: ['Architecture', 'Leadership', 'System Design'],
                focus: 'Lead projects and mentor others'
            });
        }

        res.json({
            success: true,
            roadmap
        });

    } catch (error) {
        console.error('❌ Roadmap error:', error);
        res.status(500).json({ error: 'Failed to generate roadmap' });
    }
});

// =============================================
// HELPER FUNCTIONS
// =============================================

/**
 * Estimate learning hours based on target level
 */
function getEstimatedHours(level) {
    const hours = {
        beginner: 20,
        intermediate: 50,
        advanced: 100,
        expert: 200
    };
    return hours[level?.toLowerCase()] || 40;
}

/**
 * Format database resources for API response
 */
function formatResources(resources) {
    return resources.map(r => ({
        title: r.title,
        url: r.url,
        platform: r.platform,
        type: r.resource_type,
        duration: r.duration_hours ? `${r.duration_hours} hours` : 'Self-paced',
        difficulty: r.difficulty,
        isFree: r.is_free,
        rating: r.rating
    }));
}

/**
 * Get default resources when not in database
 */
function getDefaultResources(skillName) {
    const encodedSkill = encodeURIComponent(skillName);

    return [
        {
            title: `${skillName} Tutorial - freeCodeCamp`,
            url: `https://www.freecodecamp.org/news/search/?query=${encodedSkill}`,
            platform: 'freeCodeCamp',
            type: 'course',
            duration: 'Self-paced',
            difficulty: 'beginner',
            isFree: true
        },
        {
            title: `Learn ${skillName} - YouTube`,
            url: `https://www.youtube.com/results?search_query=${encodedSkill}+tutorial+for+beginners`,
            platform: 'YouTube',
            type: 'video',
            duration: 'Varies',
            difficulty: 'beginner',
            isFree: true
        },
        {
            title: `${skillName} Documentation`,
            url: `https://www.google.com/search?q=${encodedSkill}+official+documentation`,
            platform: 'Official Docs',
            type: 'documentation',
            duration: 'Reference',
            difficulty: 'all-levels',
            isFree: true
        },
        {
            title: `${skillName} Projects - GitHub`,
            url: `https://github.com/topics/${encodedSkill.toLowerCase()}`,
            platform: 'GitHub',
            type: 'project',
            duration: 'Varies',
            difficulty: 'intermediate',
            isFree: true
        }
    ];
}

module.exports = router;
