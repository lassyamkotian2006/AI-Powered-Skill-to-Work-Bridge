/**
 * AI Career Advice Routes
 * ----------------------
 * API endpoints for intelligent career guidance:
 * - POST /api/ai/career-advice - Get personalized advice based on skills and interests
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const dbService = require('../services/supabaseService');
const jobMatcher = require('../services/jobMatcher');
const aiService = require('../services/ai');

const router = express.Router();

/**
 * POST /api/ai/career-advice
 * Get personalized career advice
 */
router.post('/career-advice', requireAuth, async (req, res) => {
    try {
        const { interests } = req.body;
        console.log(`🤖 Providing career advice for ${req.session.user.login} (Interests: ${interests || 'none'})`);

        // Get user skills
        let userSkills = [];
        try {
            const dbUser = await dbService.getUserByGithubId(req.session.user.id);
            if (dbUser) {
                userSkills = await dbService.getUserSkills(dbUser.id);
            }
        } catch (dbError) {
            console.log('Database lookup skipped for AI advice:', dbError.message);
        }

        // Fallback to session skills
        if (userSkills.length === 0 && req.session.extractedSkills) {
            userSkills = req.session.extractedSkills.map(s => ({
                name: s.name,
                level: s.level,
                category: s.category
            }));
        } else {
            // Format DB skills for AI service
            userSkills = userSkills.map(s => ({
                name: s.skills?.name || s.name,
                level: s.proficiency_level || s.level,
                category: s.skills?.category || s.category
            }));
        }

        // Get current job roles for context
        let jobRoles = [];
        try {
            jobRoles = await dbService.getJobRoles();
        } catch (dbError) { }

        if (jobRoles.length === 0) {
            // Small set of hardcoded roles for AI context if DB is empty
            jobRoles = [
                { title: 'Frontend Developer', experience_level: 'entry' },
                { title: 'Backend Developer', experience_level: 'entry' },
                { title: 'Full Stack Developer', experience_level: 'mid' },
                { title: 'DevOps Engineer', experience_level: 'mid' },
                { title: 'Data Scientist', experience_level: 'mid' }
            ];
        }

        // Get current match scores for context
        const matches = jobMatcher.getTopJobMatches(userSkills, jobRoles, 3);

        // Get AI advice
        const advice = await aiService.getCareerAdvice(userSkills, interests, matches);

        res.json({
            success: true,
            advice
        });

    } catch (error) {
        console.error('❌ Career advice error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get career advice',
            error: error.message
        });
    }
});

module.exports = router;
