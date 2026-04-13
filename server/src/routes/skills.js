/**
 * Skills Analysis Routes
 * ----------------------
 * API endpoints for analyzing repositories and extracting skills:
 * - POST /skills/analyze - Analyze repos and extract skills
 * - GET /skills - Get user's extracted skills
 * - POST /skills/sync - Sync GitHub data and update database
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const githubService = require('../services/github');
const aiService = require('../services/ai');
const dbService = require('../services/supabaseService');

const router = express.Router();

/**
 * POST /skills/analyze
 * Analyze user's GitHub repositories and extract technical skills
 * This is the main skill extraction endpoint
 */
router.post('/analyze', requireAuth, async (req, res) => {
    try {
        const { user, accessToken } = req.session;
        const selectedRepoNames = req.body.repositories || [];
        console.log(`\n🔍 Starting skill analysis for: ${user.login}`);

        // Step 1: Get user's repositories from GitHub
        console.log('📚 Fetching repositories...');
        let repos = await githubService.getUserRepos(accessToken);
        console.log(`   Found ${repos.length} repositories`);

        // Filter to selected repositories if specified
        if (selectedRepoNames.length > 0) {
            repos = repos.filter(repo => selectedRepoNames.includes(repo.name));
            console.log(`   Filtered to ${repos.length} selected repositories`);
        }

        // Step 2: Get detailed info for repositories
        // Default to analyzing all repos unless a limit is provided.
        const maxRepos = Number.isFinite(parseInt(req.query.limit))
            ? parseInt(req.query.limit)
            : repos.length;
        const topRepos = repos.slice(0, maxRepos);

        console.log(`📂 Fetching details for top ${topRepos.length} repos...`);
        const repoDetails = await Promise.all(
            topRepos.map(async repo => {
                try {
                    const details = await githubService.getRepoDetails(
                        accessToken,
                        user.login,
                        repo.name
                    );
                    return { ...repo, ...details };
                } catch (err) {
                    console.log(`   ⚠️ Could not get details for ${repo.name}`);
                    return repo;
                }
            })
        );

        // Step 3: Extract skills using AI
        console.log('🤖 Extracting skills with AI...');
        const extractedSkills = await aiService.analyzeAllRepos(repoDetails);

        // Step 4: Match with database skills and save
        let savedSkills = [];
        try {
            const dbSkills = await dbService.getAllSkills();

            // Match extracted skills to database skill IDs or create them
            const matchedSkills = [];
            for (const skill of extractedSkills) {
                let dbSkill = dbSkills.find(
                    s => s.name.toLowerCase() === skill.name.toLowerCase()
                );

                // If skill doesn't exist in master list, create it!
                if (!dbSkill) {
                    try {
                        console.log(`✨ Creating new master skill: ${skill.name}`);
                        dbSkill = await dbService.addSkill(skill.name, skill.category || 'other');
                    } catch (addErr) {
                        console.log(`   ⚠️ Failed to create skill ${skill.name}:`, addErr.message);
                    }
                }

                if (dbSkill) {
                    matchedSkills.push({
                        ...skill,
                        skillId: dbSkill.id
                    });
                }
            }

            // Save to database if user exists
            const dbUser = await dbService.getUserById(user.id);
            if (dbUser && matchedSkills.length > 0) {
                console.log(`💾 Saving ${matchedSkills.length} matched skills to database for user ${dbUser.id}...`);
                savedSkills = await dbService.saveUserSkills(dbUser.id, matchedSkills);
                console.log(`✅ Saved ${savedSkills.length} skills to database`);
            } else {
                console.log(`⚠️ Skip saving: user found? ${!!dbUser}, matched skills: ${matchedSkills.length}`);
            }
        } catch (dbError) {
            console.log('⚠️ Database save skipped:', dbError.message);
        }

        // Step 5: Save skills to session for use by jobs/learning routes
        req.session.extractedSkills = extractedSkills;

        // Step 6: Return results
        console.log(`✅ Analysis complete! Found ${extractedSkills.length} skills\n`);

        res.json({
            success: true,
            message: 'Skill analysis complete',
            stats: {
                reposAnalyzed: repoDetails.length,
                totalRepos: repos.length,
                skillsFound: extractedSkills.length,
                skillsSaved: savedSkills.length
            },
            skills: extractedSkills.map(s => ({
                name: s.name,
                category: s.category,
                level: s.level,
                confidence: s.confidence,
                repoCount: s.repoCount,
                evidence: s.evidence?.slice(0, 3) // Limit evidence
            }))
        });

    } catch (error) {
        console.error('❌ Skill analysis error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to analyze skills',
            message: error.message
        });
    }
});

/**
 * GET /skills
 * Get user's previously extracted skills from database
 */
router.get('/', requireAuth, async (req, res) => {
    try {
        const dbUser = await dbService.getUserById(req.session.user.id);

        if (!dbUser) {
            console.error(`❌ User not found in database for session ID: ${req.session.user.id}`);
            return res.status(404).json({
                error: 'User not found',
                message: 'Please analyze your skills first using POST /skills/analyze'
            });
        }

        const skills = await dbService.getUserSkills(dbUser.id);
        console.log(`📊 Job Recommendations: Found ${skills.length} skills for user ${dbUser.id}`);

        // If DB is empty, check session cache to prevent UI disappearance after fresh analysis
        if (skills.length === 0 && req.session.extractedSkills) {
            console.log('🔄 Serving skills from session cache (DB pending/empty)');
            return res.json({
                success: true,
                count: req.session.extractedSkills.length,
                skills: req.session.extractedSkills
            });
        }

        res.json({
            success: true,
            count: skills.length,
            skills: skills.map(s => ({
                name: s.skills?.name,
                category: s.skills?.category,
                level: s.proficiency_level,
                confidence: s.confidence_score,
                repoCount: s.repo_count,
                evidence: s.evidence
            }))
        });

    } catch (error) {
        console.error('❌ Get skills error:', error);
        res.status(500).json({ error: 'Failed to get skills', message: error.message });
    }
});

/**
 * POST /skills/sync
 * Sync GitHub data to database (save user and repos)
 */
router.post('/sync', requireAuth, async (req, res) => {
    try {
        const { user, accessToken } = req.session;

        // Save user to database
        const dbUser = await dbService.saveUser({
            id: user.githubId, // Using the GitHub ID for the upsert
            login: user.login,
            name: user.name,
            avatar_url: user.avatarUrl,
            html_url: user.profileUrl
        }, accessToken);

        console.log(`👤 Sync: Successfully synced GitHub user ${user.login} (${user.githubId})`);

        // Get and save repositories
        const repos = await githubService.getUserRepos(accessToken);
        const savedRepos = await dbService.saveRepositories(dbUser.id, repos);

        res.json({
            success: true,
            message: 'GitHub data synced to database',
            user: {
                id: dbUser.id,
                username: dbUser.username
            },
            reposSaved: savedRepos.length
        });

    } catch (error) {
        console.error('❌ Sync error:', error);
        res.status(500).json({ error: 'Failed to sync data', message: error.message });
    }
});

/**
 * GET /skills/summary
 * Get a quick summary of user's skill profile
 */
router.get('/summary', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        console.log(`\n📊 Starting skill summary for user ID: ${userId}`);

        const dbUser = await dbService.getUserById(userId);

        if (!dbUser) {
            console.error(`❌ User not found for ID: ${userId}`);
            return res.status(404).json({ error: 'User not found' });
        }

        console.log(`👤 Found user: ${dbUser.username} (${dbUser.id})`);

        const skills = await dbService.getUserSkills(dbUser.id);
        console.log(`📊 Found ${skills.length} skills for user`);

        // Group by category
        const byCategory = {};
        for (const skill of skills) {
            const category = skill.skills?.category || 'other';
            if (!byCategory[category]) byCategory[category] = [];
            byCategory[category].push(skill.skills?.name);
        }
        console.log(`Categorized skills into ${Object.keys(byCategory).length} categories`);

        // Group by level
        const byLevel = { expert: [], advanced: [], intermediate: [], beginner: [] };
        for (const skill of skills) {
            const level = skill.proficiency_level || 'beginner';
            if (byLevel[level]) {
                byLevel[level].push(skill.skills?.name);
            }
        }

        res.json({
            success: true,
            totalSkills: skills.length,
            byCategory,
            byLevel,
            topSkills: skills.slice(0, 5).map(s => s.skills?.name)
        });

    } catch (error) {
        res.status(500).json({ error: 'Failed to get summary' });
    }
});

module.exports = router;
