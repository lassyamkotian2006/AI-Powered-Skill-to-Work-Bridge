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
 * Generate personalized learning path using HuggingFace AI (via Python microservice)
 */
router.get('/path', requireAuth, async (req, res) => {
    try {
        console.log(`📚 Requesting AI learning path for ${req.session.user.login}`);

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

        // 3. Get interests and target role
        const interest = dbUser.interests || "General Software Engineering";
        const targetRole = dbUser.target_role || dbUser.recommended_role || "Software Developer";

        // --- CACHE CHECK ---
        const cacheKey = `${dbUser.id}-${targetRole}-${interest}`;
        if (learningPathCache.has(cacheKey)) {
            console.log('⚡ Serving learning path from cache');
            return res.json(learningPathCache.get(cacheKey));
        }

        let aiData;
        try {
            const pythonResponse = await fetch(`${AI_SERVICE_URL}/generate-learning-path`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    skills: skillsForAI,
                    interest: interest,
                    target_role: targetRole
                }),
                timeout: 8000 // 8 second timeout
            });

            if (pythonResponse.ok) {
                aiData = await pythonResponse.json();
            }
        } catch (fetchError) {
            console.error('⚠️ Python AI service unreachable or timed out:', fetchError.message);
        }

        let parsedPath;
        let matchPercentageFromAI = 0;

        if (aiData && aiData.success) {
            // Tier 1: Use Python AI microservice generated path
            parsedPath = parseAIRoadmap(aiData.learning_path);
            matchPercentageFromAI = aiData.match_percentage;
            console.log(`Tier 1 (Python AI): Learning path generated with ${aiData.match_percentage}% match`);
        } else {
            // Tier 2: Try Groq AI for structured learning path
            console.log('Tier 2: Attempting Groq AI learning path...');
            const groqPath = await aiService.generateAILearningPath(skillsForAI, targetRole);

            if (groqPath) {
                parsedPath = [];

                if (groqPath.missing_skills && groqPath.missing_skills.length > 0) {
                    parsedPath.push({
                        title: 'Missing Skills',
                        items: groqPath.missing_skills
                    });
                }

                if (groqPath.technologies_to_learn && groqPath.technologies_to_learn.length > 0) {
                    parsedPath.push({
                        title: 'Technologies to Learn',
                        items: groqPath.technologies_to_learn
                    });
                }

                if (groqPath.step_by_step_plan && groqPath.step_by_step_plan.length > 0) {
                    parsedPath.push({
                        title: 'Step-by-Step Roadmap',
                        items: groqPath.step_by_step_plan
                    });
                }

                if (groqPath.recommended_projects && groqPath.recommended_projects.length > 0) {
                    parsedPath.push({
                        title: 'Recommended Projects',
                        items: groqPath.recommended_projects
                    });
                }

                // Calculate match from jobMatcher for the progress bar
                const jobRoles = await dbService.getJobRoles();
                const targetRoleObj = (jobRoles || []).find(r => r.title === targetRole);
                const match = jobMatcher.calculateJobMatch(skillsForAI, targetRoleObj || { title: targetRole }, interest);
                matchPercentageFromAI = match.score;
                console.log(`Tier 2 (Groq AI): Learning path generated with ${parsedPath.length} sections`);
            } else {
                // Tier 3: Basic fallback from skill-gap analysis
                console.log('Tier 3: Using jobMatcher fallback');
                const jobRoles = await dbService.getJobRoles();
                const targetRoleObj = (jobRoles || []).find(r => r.title === targetRole);

                const match = jobMatcher.calculateJobMatch(skillsForAI, targetRoleObj || { title: targetRole }, interest);
                matchPercentageFromAI = match.score;

                parsedPath = [
                    {
                        title: 'Current Skill Gaps',
                        items: match.missingSkills.length > 0
                            ? match.missingSkills.map(s => `${s.name} (${s.importance})`)
                            : ['No major gaps detected! Focus on deep diving into your existing stack.']
                    },
                    {
                        title: 'Recommended Roadmap',
                        items: match.roadmap.steps.map(s => `Master ${s.skill} to ${s.targetLevel} level (~${s.estimatedHours}h)`)
                    },
                    {
                        title: 'Next Steps',
                        items: [
                            `Focus on ${match.missingSkills[0]?.name || 'advanced projects'} first.`,
                            'Build a portfolio project demonstrating these new skills.',
                            'Review official documentation and community tutorials.'
                        ]
                    }
                ];
            }
        }

        // --- Job Readiness Score Calculation ---
        const userSkillNames = skillsForAI.map(s => (s.name || '').toLowerCase());
        const requiredSkills = roleSkillMap[targetRole] || [];
        let readinessScore = matchPercentageFromAI;

        if (requiredSkills.length > 0) {
            const matchedSkills = requiredSkills.filter(skill =>
                userSkillNames.some(s => s.includes(skill.toLowerCase()))
            );
            const missingSkills = requiredSkills.filter(skill =>
                !userSkillNames.some(s => s.includes(skill.toLowerCase()))
            );
            readinessScore = Math.round((matchedSkills.length / requiredSkills.length) * 100);

            // Add skill gap section if not already present
            const hasGapSection = parsedPath.some(s => s.title === 'Current Skill Gaps');
            if (!hasGapSection && missingSkills.length > 0) {
                parsedPath.push({
                    title: 'Current Skill Gaps',
                    items: missingSkills
                });
            }

            // Add recommended learning resources
            const hasResourceSection = parsedPath.some(s => s.title === 'Recommended Learning');
            if (!hasResourceSection && missingSkills.length > 0) {
                const recommendedLearning = missingSkills.map(skill => {
                    const resource = learningResources[skill];
                    if (resource) {
                        return `${skill} → ${resource.title}`;
                    }
                    return `${skill} → Search: https://www.youtube.com/results?search_query=${encodeURIComponent(skill)}+tutorial`;
                });
                parsedPath.push({
                    title: 'Recommended Learning',
                    items: recommendedLearning
                });
            }

            console.log(`Job Readiness Score: ${readinessScore}% (${matchedSkills.length}/${requiredSkills.length} skills matched)`);
        }

        const responseData = {
            success: true,
            summary: {
                matchPercentage: readinessScore,
                targetRole: targetRole,
                interest: interest,
                isAI: !!(aiData && aiData.success)
            },
            learningPath: parsedPath
        };

        // Save to cache
        learningPathCache.set(cacheKey, responseData);

        res.json(responseData);

    } catch (error) {
        console.error('❌ AI Learning path error, using skill gap fallback:', error.message);

        // Skill gap detection fallback
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
                    return `${skill} → ${resource.title}`;
                }
                return `${skill} → Search tutorial: https://www.youtube.com/results?search_query=${encodeURIComponent(skill)}+tutorial`;
            });

            const responseData = {
                success: true,
                summary: {
                    matchPercentage: requiredSkills.length > 0 ? Math.round(((requiredSkills.length - missingSkills.length) / requiredSkills.length) * 100) : 0,
                    targetRole: targetRole,
                    interest: dbUser?.interests || 'General',
                    isAI: false
                },
                learningPath: [
                    {
                        title: 'Current Skill Gaps',
                        items: missingSkills.length > 0 ? missingSkills : ['No major gaps detected! Focus on deepening your existing skills.']
                    },
                    {
                        title: 'Recommended Learning',
                        items: recommendedLearning.length > 0 ? recommendedLearning : ['Keep practicing with real-world projects to solidify your skills.']
                    }
                ]
            };

            learningPathCache.set(`fallback-${targetRole}`, responseData);
            res.json(responseData);
        } catch (fallbackError) {
            console.error('❌ Fallback also failed:', fallbackError.message);
            res.json({
                success: true,
                summary: { matchPercentage: 0, targetRole: 'Software Developer', interest: 'General', isAI: false },
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
