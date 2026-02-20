/**
 * Repository Routes
 * -----------------
 * API endpoints for fetching GitHub repository information:
 * - GET /repos - List all repositories for the logged-in user
 * - GET /repos/:owner/:repo/details - Get detailed info about a specific repo
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const githubService = require('../services/github');

const router = express.Router();

/**
 * GET /repos
 * Returns a list of all repositories for the authenticated user
 * Requires authentication
 */
router.get('/', requireAuth, async (req, res) => {
    try {
        console.log(`📚 Fetching repositories for user: ${req.session.user.login}`);

        const repos = await githubService.getUserRepos(req.session.accessToken);

        res.json({
            count: repos.length,
            repositories: repos
        });

    } catch (error) {
        console.error('❌ Error fetching repositories:', error.message);
        res.status(500).json({
            error: 'Failed to fetch repositories',
            message: error.message
        });
    }
});

/**
 * GET /repos/:owner/:repo/details
 * Returns detailed information about a specific repository:
 * - README.md content
 * - List of file extensions used
 * - Last 5 commit messages
 * 
 * Requires authentication
 */
router.get('/:owner/:repo/details', requireAuth, async (req, res) => {
    const { owner, repo } = req.params;

    try {
        console.log(`🔍 Fetching details for repo: ${owner}/${repo}`);

        const details = await githubService.getRepoDetails(
            req.session.accessToken,
            owner,
            repo
        );

        res.json({
            repository: `${owner}/${repo}`,
            readme: details.readme,
            fileExtensions: details.extensions,
            languages: details.languages,
            lastCommits: details.commits
        });

    } catch (error) {
        console.error(`❌ Error fetching repo details for ${owner}/${repo}:`, error.message);

        // Handle specific error cases
        if (error.status === 404) {
            return res.status(404).json({
                error: 'Repository not found',
                message: `Could not find repository: ${owner}/${repo}`
            });
        }

        res.status(500).json({
            error: 'Failed to fetch repository details',
            message: error.message
        });
    }
});

module.exports = router;
