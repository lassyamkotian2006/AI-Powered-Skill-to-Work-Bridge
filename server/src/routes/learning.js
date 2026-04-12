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

const router = express.Router();

// Get AI service URL from environment or default to localhost
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5001';

// Cache with automatic expiry
const learningPathCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// =============================================
// FUZZY SKILL MATCHING HELPERS
// =============================================

/**
 * Normalize a skill name for comparison
 */
function normalizeSkillName(name) {
    if (!name) return '';
    return name
        .toLowerCase()
        .trim()
        .replace(/[\.\-\/]/g, '')
        .replace(/\s+/g, '')
        .replace('javascript', 'js')
        .replace('typescript', 'ts')
        .replace('nodejs', 'node')
        .replace('reactjs', 'react')
        .replace('vuejs', 'vue')
        .replace('nextjs', 'next')
        .replace('postgresql', 'postgres')
        .replace('mysql', 'sql')
        .replace('mongodb', 'mongo')
        .replace('kubernetes', 'k8s');
}

/**
 * Check if two skill names match (fuzzy matching)
 */
function skillsMatch(skill1, skill2) {
    if (!skill1 || !skill2) return false;
    
    const s1 = normalizeSkillName(skill1);
    const s2 = normalizeSkillName(skill2);
    
    // Exact match after normalization
    if (s1 === s2) return true;
    
    // One contains the other
    if (s1.includes(s2) || s2.includes(s1)) return true;
    
    // Handle common variations via alias groups
    const aliasGroups = [
        ['js', 'javascript'],
        ['ts', 'typescript'],
        ['node', 'nodejs'],
        ['react', 'reactjs'],
        ['vue', 'vuejs'],
        ['next', 'nextjs'],
        ['postgres', 'postgresql'],
        ['mongo', 'mongodb'],
        ['aws', 'amazonwebservices'],
        ['k8s', 'kubernetes'],
        ['css', 'css3'],
        ['html', 'html5'],
        ['python', 'python3'],
        ['git', 'github'],
        ['docker', 'dockercontainer'],
        ['ml', 'machinelearning'],
        ['ai', 'artificialintelligence'],
        ['nlp', 'naturallanguageprocessing'],
        ['csharp', 'c', 'net'],
        ['cpp', 'c++'],
        ['sass', 'scss'],
        ['rest', 'restapi', 'restful'],
        ['ci', 'cicd'],
        ['excel', 'spreadsheet'],
        ['tableau', 'powerbi', 'dataviz'],
        ['jira', 'confluence'],
        ['figma', 'sketch', 'adobexd'],
        ['selenium', 'cypress', 'playwright'],
        ['jest', 'mocha', 'chai', 'vitest'],
        ['webpack', 'vite', 'rollup', 'esbuild'],
        ['npm', 'yarn', 'pnpm'],
        ['linux', 'unix', 'bash', 'shell'],
        ['redis', 'memcached'],
        ['firebase', 'supabase'],
        ['vercel', 'netlify', 'railway'],
        ['jenkins', 'githubactions', 'gitlabci'],
        ['terraform', 'ansible', 'puppet'],
        ['spring', 'springboot'],
        ['laravel', 'php'],
        ['django', 'flask', 'fastapi'],
        ['angular', 'ngx'],
        ['redux', 'zustand', 'recoil'],
        ['tailwind', 'tailwindcss'],
        ['bootstrap', 'materialui', 'chakra'],
        ['graphql', 'gql'],
        ['prisma', 'sequelize', 'typeorm', 'mongoose'],
        ['unittest', 'integrationtest', 'e2e']
    ];
    
    for (const group of aliasGroups) {
        const normalizedGroup = group.map(g => normalizeSkillName(g));
        if (normalizedGroup.includes(s1) && normalizedGroup.includes(s2)) {
            return true;
        }
    }
    
    return false;
}

// =============================================
// ROUTES
// =============================================

/**
 * GET /learning/path
 * Generate personalized learning path with improved fuzzy skill matching
 */
router.get('/path', requireAuth, async (req, res) => {
    try {
        console.log(`\n📚 Requesting learning path for ${req.session.user.login}`);

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

        console.log(`   Found ${skillsForAI.length} user skills: ${skillsForAI.slice(0, 5).map(s => s.name).join(', ')}${skillsForAI.length > 5 ? '...' : ''}`);

        // 3. Get target role
        const targetRole = dbUser.target_role || dbUser.recommended_role || "Software Developer";
        console.log(`   Target role: ${targetRole}`);

        // --- CACHE CHECK ---
        const cacheKey = `${dbUser.id}-${targetRole}`;
        const cachedEntry = learningPathCache.get(cacheKey);
        if (cachedEntry && Date.now() - cachedEntry.timestamp < CACHE_TTL) {
            console.log('⚡ Serving learning path from cache');
            return res.json(cachedEntry.data);
        }

        // =============================================
        // STEP 1: IMPROVED SKILL GAP ANALYSIS
        // =============================================
        const userSkillNames = skillsForAI.map(s => normalizeSkillName(s.name || ''));
        const requiredSkills = roleSkillMap[targetRole] || [];
        
        let readinessScore = 0;
        let matchedSkills = [];
        let missingSkills = [];

        if (requiredSkills.length > 0) {
            for (const requiredSkill of requiredSkills) {
                const normalizedRequired = normalizeSkillName(requiredSkill);
                
                const hasSkill = userSkillNames.some(userSkill => {
                    return skillsMatch(userSkill, normalizedRequired);
                });

                if (hasSkill) {
                    matchedSkills.push(requiredSkill);
                } else {
                    missingSkills.push(requiredSkill);
                }
            }
            
            readinessScore = Math.round((matchedSkills.length / requiredSkills.length) * 100);
            console.log(`   Skill Gap Analysis: ${matchedSkills.length}/${requiredSkills.length} matched (${readinessScore}%)`);
            if (matchedSkills.length > 0) console.log(`   ✅ Matched: ${matchedSkills.join(', ')}`);
            if (missingSkills.length > 0) console.log(`   ❌ Missing: ${missingSkills.join(', ')}`);
        } else {
            console.log(`   ⚠️ No roleSkillMap entry for "${targetRole}"`);
        }

        // =============================================
        // STEP 2: BUILD LEARNING PATH
        // =============================================
        let learningPath = [];

        // Section: Skill Gaps
        if (missingSkills.length > 0) {
            learningPath.push({
                title: '🎯 Missing Skills',
                items: missingSkills.map(skill => `${skill} — required for ${targetRole}`)
            });
        } else if (requiredSkills.length > 0) {
            learningPath.push({
                title: '✅ Skill Gaps',
                items: ['Excellent! You have all the core skills for this role.']
            });
        }

        // Section: Roadmap
        if (missingSkills.length > 0) {
            const roadmapSteps = missingSkills.map((skill, i) => {
                const resource = learningResources[skill];
                const resourceLink = resource 
                    ? `${resource.title} (${resource.url})`
                    : `Search tutorials for ${skill}`;
                return `Step ${i + 1}: Learn ${skill} → ${resourceLink}`;
            });
            roadmapSteps.push(`Step ${missingSkills.length + 1}: Build a portfolio project combining your new skills`);
            roadmapSteps.push(`Step ${missingSkills.length + 2}: Prepare for ${targetRole} interviews`);
            roadmapSteps.push(`Step ${missingSkills.length + 3}: Apply for ${targetRole} positions`);

            learningPath.push({
                title: '🗺️ Learning Roadmap',
                items: roadmapSteps
            });
        } else {
            learningPath.push({
                title: '🗺️ Next Steps',
                items: [
                    'Deepen expertise in your strongest skills',
                    'Build advanced portfolio projects',
                    'Contribute to open source in your domain',
                    'Practice system design and architecture',
                    `Apply for ${targetRole} positions`
                ]
            });
        }

        // Section: Resources
        if (missingSkills.length > 0) {
            const resourceItems = missingSkills.map(skill => {
                const resource = learningResources[skill];
                if (resource) {
                    return `📖 ${skill} → ${resource.title}\n   ${resource.url}`;
                }
                return `📖 ${skill} → https://www.youtube.com/results?search_query=${encodeURIComponent(skill + ' tutorial for beginners')}`;
            });
            learningPath.push({
                title: '📚 Recommended Resources',
                items: resourceItems
            });
        }

        // Section: Strengths
        if (matchedSkills.length > 0) {
            learningPath.push({
                title: '💪 Your Strengths',
                items: matchedSkills.map(skill => `${skill} — you already have this skill`)
            });
        }

        // =============================================
        // STEP 3: AI ENHANCEMENT (optional)
        // =============================================
        let isAI = false;

        // Try Python AI microservice
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
            
            const pythonResponse = await fetch(`${AI_SERVICE_URL}/generate-learning-path`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    skills: skillsForAI,
                    interest: targetRole,
                    target_role: targetRole
                }),
                signal: controller.signal
            });
            
            clearTimeout(timeout);

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
                        console.log('🤖 AI Enhancement: Python microservice path added');
                    }
                }
            }
        } catch (fetchError) {
            console.log('⚠️ Python AI unavailable:', fetchError.message);
        }

        // Try Groq if Python failed
        if (!isAI) {
            try {
                const groqPath = await aiService.generateAILearningPath(skillsForAI, targetRole);
                if (groqPath) {
                    const aiSections = [];
                    if (groqPath.missing_skills?.length > 0) {
                        aiSections.push({ title: '🤖 AI-Detected Missing Skills', items: groqPath.missing_skills });
                    }
                    if (groqPath.step_by_step_plan?.length > 0) {
                        aiSections.push({ title: '🤖 AI-Generated Roadmap', items: groqPath.step_by_step_plan });
                    }
                    if (groqPath.recommended_projects?.length > 0) {
                        aiSections.push({ title: '🤖 Recommended Projects', items: groqPath.recommended_projects });
                    }
                    if (aiSections.length > 0) {
                        learningPath.unshift(...aiSections);
                        isAI = true;
                        console.log('🤖 AI Enhancement: Groq path added');
                    }
                }
            } catch (groqError) {
                console.log('⚠️ Groq AI unavailable:', groqError.message);
            }
        }

        // =============================================
        // STEP 4: HANDLE UNKNOWN ROLES
        // =============================================
        if (requiredSkills.length === 0 && !isAI) {
            learningPath = generateFallbackPath(targetRole);
            console.log(`Using fallback roadmap for unknown role: ${targetRole}`);
        }

        // =============================================
        // BUILD RESPONSE
        // =============================================
        const responseData = {
            success: true,
            summary: {
                matchPercentage: readinessScore,
                targetRole: targetRole,
                isAI: isAI,
                skillsAnalyzed: skillsForAI.length,
                skillsMatched: matchedSkills.length,
                skillsMissing: missingSkills.length
            },
            learningPath: learningPath
        };

        // Cache the response
        learningPathCache.set(cacheKey, {
            data: responseData,
            timestamp: Date.now()
        });

        console.log(`✅ Learning path generated: ${readinessScore}% ready for ${targetRole}\n`);
        res.json(responseData);

    } catch (error) {
        console.error('❌ Learning path error:', error.message);

        res.json({
            success: true,
            summary: { matchPercentage: 0, targetRole: 'Software Developer', isAI: false, skillsAnalyzed: 0, skillsMatched: 0, skillsMissing: 0 },
            learningPath: generateFallbackPath('Software Developer')
        });
    }
});

/**
 * Parse AI roadmap text into structured sections
 */
function parseAIRoadmap(text) {
    if (!text) return [];

    const sections = {
        'Missing Skills': [],
        'Technologies to Learn': [],
        'Roadmap': [],
        'Tools & Frameworks': [],
        'Projects': []
    };

    let currentSection = 'Roadmap';
    const lines = text.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (trimmed.toLowerCase().includes('missing skills')) currentSection = 'Missing Skills';
        else if (trimmed.toLowerCase().includes('technologies')) currentSection = 'Technologies to Learn';
        else if (trimmed.toLowerCase().includes('roadmap') || trimmed.toLowerCase().includes('step')) currentSection = 'Roadmap';
        else if (trimmed.toLowerCase().includes('tools') || trimmed.toLowerCase().includes('frameworks')) currentSection = 'Tools & Frameworks';
        else if (trimmed.toLowerCase().includes('project')) currentSection = 'Projects';
        else if (trimmed.startsWith('*') || trimmed.startsWith('-') || /^\d+\./.test(trimmed)) {
            const content = trimmed.replace(/^[\*\-\d\.]+\s*/, '');
            if (content) sections[currentSection].push(content);
        }
    }

    return Object.entries(sections)
        .filter(([_, items]) => items.length > 0)
        .map(([title, items]) => ({ title, items }));
}

/**
 * GET /learning/resources/:skillName
 */
router.get('/resources/:skillName', async (req, res) => {
    try {
        const skillName = req.params.skillName;
        const allSkills = await dbService.getAllSkills();

        const skill = allSkills.find(
            s => s.name.toLowerCase() === skillName.toLowerCase()
        );

        if (!skill) {
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
 */
router.get('/roadmap', requireAuth, async (req, res) => {
    try {
        const dbUser = await dbService.getUserById(req.session.user.id);
        if (!dbUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userSkills = await dbService.getUserSkills(dbUser.id);
        const jobRoles = await dbService.getJobRoles();

        const careerPath = jobMatcher.suggestCareerPath(
            userSkills.map(s => ({ name: s.skills?.name, level: s.proficiency_level })),
            jobRoles
        );

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

        if (careerPath.currentFit?.missingSkills?.length > 0) {
            roadmap.milestones.push({
                title: 'Foundation Building',
                timeframe: '1-3 months',
                goal: `Become job-ready for ${careerPath.currentFit.jobTitle}`,
                skills: careerPath.currentFit.missingSkills.slice(0, 3).map(s => s.name),
                focus: 'Learn fundamentals and build small projects'
            });
        }

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

        if (careerPath.nextStep) {
            roadmap.milestones.push({
                title: 'Career Advancement',
                timeframe: '6-12 months',
                goal: `Prepare for ${careerPath.nextStep.jobTitle}`,
                skills: careerPath.skillsForNextLevel?.slice(0, 4).map(s => s.name) || [],
                focus: 'Master advanced concepts and specialize'
            });
        }

        if (careerPath.longTermGoal) {
            roadmap.milestones.push({
                title: 'Expert Level',
                timeframe: '1-2 years',
                goal: `Achieve ${careerPath.longTermGoal.jobTitle} status`,
                skills: ['Architecture', 'Leadership', 'System Design'],
                focus: 'Lead projects and mentor others'
            });
        }

        res.json({ success: true, roadmap });

    } catch (error) {
        console.error('❌ Roadmap error:', error);
        res.status(500).json({ error: 'Failed to generate roadmap' });
    }
});

// =============================================
// HELPERS
// =============================================

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
