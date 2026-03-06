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
const { generateFallbackPath } = require('../services/learningFallback');
const roleSkillMap = require('../services/roleSkillMap');
const learningResources = require('../services/learningResources');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const router = express.Router();

// Get AI service URL from environment or default to localhost
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5001';

// Simple in-memory cache for learning paths
const learningPathCache = new Map();

/**
 * GET /learning/path
 * Generate personalized learning path
 * Priority: roleSkillMap gap analysis (always works) + AI enhancement (when available)
 */
router.get('/path', requireAuth, async (req, res) => {
    try {
        console.log(`📚 Requesting learning path for ${req.session.user.login}`);

        // 1. Get user data from database
        const dbUser = await dbService.getUserById(req.session.user.id);
        if (!dbUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        // 2. Get user skills
        let userSkills = await dbService.getUserSkills(dbUser.id);
        const skillsForAI = userSkills.map(s => ({
            name: s.skills?.name || s.name,
            level: s.proficiency_level || s.level,
            category: s.skills?.category
        }));

        // 3. Get target role (career goal)
        const targetRole = dbUser.target_role || dbUser.recommended_role || "Software Developer";

        // --- CACHE CHECK ---
        const cacheKey = `${dbUser.id}-${targetRole}`;
        if (learningPathCache.has(cacheKey)) {
            console.log('⚡ Serving learning path from cache');
            return res.json(learningPathCache.get(cacheKey));
        }

        // =============================================
        // STEP 1: SKILL GAP ANALYSIS (always runs)
        // Compare user skills vs required skills for the role
        // =============================================
        const userSkillNames = skillsForAI.map(s => (s.name || '').toLowerCase());
        const requiredSkills = roleSkillMap[targetRole] || [];
        let readinessScore = 0;
        let matchedSkills = [];
        let missingSkills = [];

        if (requiredSkills.length > 0) {
            matchedSkills = requiredSkills.filter(skill =>
                userSkillNames.some(s => s.includes(skill.toLowerCase()))
            );
            missingSkills = requiredSkills.filter(skill =>
                !userSkillNames.some(s => s.includes(skill.toLowerCase()))
            );
            readinessScore = Math.round((matchedSkills.length / requiredSkills.length) * 100);
            console.log(`Skill Gap: ${matchedSkills.length}/${requiredSkills.length} matched (${readinessScore}%)`);
        }

        // =============================================
        // STEP 2: BUILD PERSONALIZED LEARNING PATH
        // =============================================
        let learningPath = [];

        // Section 1: Skill Gaps
        if (missingSkills.length > 0) {
            learningPath.push({
                title: 'Skill Gaps',
                items: missingSkills.map(skill => `${skill} — required for ${targetRole}`)
            });
        } else if (requiredSkills.length > 0) {
            learningPath.push({
                title: 'Skill Gaps',
                items: ['No gaps detected! You already have the core skills for this role.']
            });
        }

        // Section 2: Step-by-step Roadmap
        if (missingSkills.length > 0) {
            const roadmapSteps = missingSkills.map((skill, i) =>
                `Step ${i + 1}: Learn ${skill}`
            );
            roadmapSteps.push(`Step ${missingSkills.length + 1}: Build a project using your new skills`);
            roadmapSteps.push(`Step ${missingSkills.length + 2}: Apply for ${targetRole} positions`);

            learningPath.push({
                title: 'Learning Roadmap',
                items: roadmapSteps
            });
        } else {
            learningPath.push({
                title: 'Learning Roadmap',
                items: [
                    'Deepen expertise in your strongest skills',
                    'Build advanced portfolio projects',
                    'Contribute to open source in your domain',
                    'Practice system design and architecture',
                    `Apply for ${targetRole} positions`
                ]
            });
        }

        // Section 3: Recommended Resources (YouTube/docs links)
        if (missingSkills.length > 0) {
            const resourceItems = missingSkills.map(skill => {
                const resource = learningResources[skill];
                if (resource) {
                    return `${skill} → ${resource.title} (${resource.url})`;
                }
                return `${skill} → Search: https://www.youtube.com/results?search_query=${encodeURIComponent(skill)}+tutorial`;
            });
            learningPath.push({
                title: 'Recommended Resources',
                items: resourceItems
            });
        }

        // Section 4: Your Strengths
        if (matchedSkills.length > 0) {
            learningPath.push({
                title: 'Your Strengths',
                items: matchedSkills.map(skill => `${skill} — you already have this skill`)
            });
        }

        // =============================================
        // STEP 3: TRY AI ENHANCEMENT (optional)
        // =============================================
        let isAI = false;

        // Try Python AI microservice first
        try {
            const pythonResponse = await fetch(`${AI_SERVICE_URL}/generate-learning-path`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    skills: skillsForAI,
                    interest: targetRole,
                    target_role: targetRole
                }),
                timeout: 8000
            });

            if (pythonResponse.ok) {
                const aiData = await pythonResponse.json();
                if (aiData.success && aiData.learning_path) {
                    const aiSections = parseAIRoadmap(aiData.learning_path);
                    if (aiSections.some(s => s.items.length > 0)) {
                        learningPath.unshift(...aiSections.filter(s => s.items.length > 0));
                        isAI = true;
                        if (aiData.match_percentage) {
                            readinessScore = Math.max(readinessScore, aiData.match_percentage);
                        }
                        console.log('AI Enhancement: Python microservice path added');
                    }
                }
            }
        } catch (fetchError) {
            console.log('⚠️ Python AI unavailable, using skill gap analysis only');
        }

        // If Python AI failed, try Groq
        if (!isAI) {
            try {
                const groqPath = await aiService.generateAILearningPath(skillsForAI, targetRole);
                if (groqPath) {
                    const aiSections = [];
                    if (groqPath.missing_skills?.length > 0) {
                        aiSections.push({ title: 'AI-Detected Missing Skills', items: groqPath.missing_skills });
                    }
                    if (groqPath.step_by_step_plan?.length > 0) {
                        aiSections.push({ title: 'AI-Generated Roadmap', items: groqPath.step_by_step_plan });
                    }
                    if (groqPath.recommended_projects?.length > 0) {
                        aiSections.push({ title: 'Recommended Projects', items: groqPath.recommended_projects });
                    }
                    if (aiSections.length > 0) {
                        learningPath.unshift(...aiSections);
                        isAI = true;
                        console.log('AI Enhancement: Groq path added');
                    }
                }
            } catch (groqError) {
                console.log('⚠️ Groq AI unavailable, using skill gap analysis only');
            }
        }

        // =============================================
        // STEP 4: HANDLE UNKNOWN ROLES (no roleSkillMap entry)
        // =============================================
        if (requiredSkills.length === 0 && !isAI) {
            learningPath = generateFallbackPath(targetRole);
            console.log(`Using fallback roadmap for unknown role: ${targetRole}`);
        }

        // =============================================
        // RESPOND
        // =============================================
        const responseData = {
            success: true,
            summary: {
                matchPercentage: readinessScore,
                targetRole: targetRole,
                isAI: isAI
            },
            learningPath: learningPath
        };

        learningPathCache.set(cacheKey, responseData);
        res.json(responseData);

    } catch (error) {
        console.error('❌ Learning path error:', error.message);

        // Emergency fallback — always return something useful
        try {
            const dbUser = await dbService.getUserById(req.session.user.id);
            const userSkills = dbUser ? await dbService.getUserSkills(dbUser.id) : [];
            const userSkillNames = userSkills.map(s => (s.skills?.name || s.name || '').toLowerCase());
            const targetRole = dbUser?.target_role || 'Software Developer';

            const requiredSkills = roleSkillMap[targetRole] || roleSkillMap['Software Developer'] || [];

            const missingSkills = requiredSkills.filter(
                skill => !userSkillNames.some(s => s.includes(skill.toLowerCase()))
            );

            const recommendedLearning = missingSkills.map(skill => {
                const resource = learningResources[skill];
                if (resource) {
                    return `${skill} → ${resource.title} (${resource.url})`;
                }
                return `${skill} → Search: https://www.youtube.com/results?search_query=${encodeURIComponent(skill)}+tutorial`;
            });

            res.json({
                success: true,
                summary: {
                    matchPercentage: requiredSkills.length > 0 ? Math.round(((requiredSkills.length - missingSkills.length) / requiredSkills.length) * 100) : 0,
                    targetRole: targetRole,
                    isAI: false
                },
                learningPath: [
                    {
                        title: 'Skill Gaps',
                        items: missingSkills.length > 0 ? missingSkills : ['No major gaps detected!']
                    },
                    {
                        title: 'Recommended Resources',
                        items: recommendedLearning.length > 0 ? recommendedLearning : ['Keep practicing with real-world projects.']
                    }
                ]
            });
        } catch (fallbackError) {
            console.error('❌ Fallback also failed:', fallbackError.message);
            res.json({
                success: true,
                summary: { matchPercentage: 0, targetRole: 'Software Developer', isAI: false },
                learningPath: generateFallbackPath('Software Developer')
            });
        }
    }
});

/**
 * Heuristic parser for AI roadmap text
 */
function parseAIRoadmap(text) {
    if (!text) return [];

    const sections = {
        'Missing Skills': [],
        'Technologies to Learn': [],
        'Roadmap': [],
        'Tools & Frameworks': []
    };

    let currentSection = 'Roadmap';
    const lines = text.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Detect section headers
        if (trimmed.toLowerCase().includes('missing skills')) currentSection = 'Missing Skills';
        else if (trimmed.toLowerCase().includes('technologies')) currentSection = 'Technologies to Learn';
        else if (trimmed.toLowerCase().includes('roadmap') || trimmed.toLowerCase().includes('step')) currentSection = 'Roadmap';
        else if (trimmed.toLowerCase().includes('tools') || trimmed.toLowerCase().includes('frameworks')) currentSection = 'Tools & Frameworks';

        // Add list items (handle bullet points)
        else if (trimmed.startsWith('*') || trimmed.startsWith('-') || /^\d+\./.test(trimmed)) {
            const content = trimmed.replace(/^[\*\-\d\.]+\s*/, '');
            if (content) sections[currentSection].push(content);
        }
    }

    // Convert to the format expected by the frontend
    return Object.entries(sections).map(([title, items]) => ({
        title,
        items
    }));
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
        const dbUser = await dbService.getUserById(req.session.user.id);
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
