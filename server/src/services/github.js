/**
 * GitHub API Service
 * ------------------
 * Wraps the Octokit library to provide clean methods for
 * fetching user data and repository information from GitHub.
 */

const { Octokit } = require('octokit');

/**
 * Creates an authenticated Octokit instance
 * @param {string} token - GitHub OAuth access token
 * @returns {Octokit} Authenticated Octokit instance
 */
function createOctokitClient(token) {
    return new Octokit({ auth: token });
}

/**
 * Fetches all repositories for the authenticated user
 * @param {string} token - GitHub OAuth access token
 * @returns {Promise<Array>} Array of repository objects
 */
async function getUserRepos(token) {
    const octokit = createOctokitClient(token);

    // Fetch repos with pagination (up to 100 per page)
    // Using 'affiliation' to get repos the user owns, collaborates on, or is org member of
    const { data } = await octokit.rest.repos.listForAuthenticatedUser({
        per_page: 100,
        sort: 'updated',
        direction: 'desc'
    });

    // Return simplified repo info
    return data.map(repo => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description,
        url: repo.html_url,
        language: repo.language,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        isPrivate: repo.private,
        updatedAt: repo.updated_at
    }));
}

/**
 * Fetches detailed information about a specific repository
 * Including: README content, file extensions used, and last 5 commits
 * 
 * @param {string} token - GitHub OAuth access token
 * @param {string} owner - Repository owner username
 * @param {string} repo - Repository name
 * @returns {Promise<Object>} Object containing readme, extensions, and commits
 */
async function getRepoDetails(token, owner, repo) {
    const octokit = createOctokitClient(token);

    // Fetch all data in parallel for better performance
    const [readme, tree, commits, languages] = await Promise.all([
        // 1. Get README content (GET /repos/{owner}/{repo}/readme)
        getReadmeContent(octokit, owner, repo),

        // 2. Get repository file tree to extract extensions
        getFileTree(octokit, owner, repo),

        // 3. Get last 5 commits
        getLastCommits(octokit, owner, repo, 5),

        // 4. Get languages (GET /repos/{owner}/{repo}/languages)
        getRepoLanguages(octokit, owner, repo)
    ]);

    // Extract unique file extensions from the tree
    const extensions = extractFileExtensions(tree);

    return {
        readme,
        extensions,
        commits,
        languages
    };
}

/**
 * Fetches the README.md content for a repository
 * Returns null if no README exists
 */
async function getReadmeContent(octokit, owner, repo) {
    try {
        const { data } = await octokit.rest.repos.getReadme({
            owner,
            repo,
            mediaType: { format: 'raw' } // Get raw markdown content
        });
        return data;
    } catch (error) {
        if (error.status === 404) {
            return null; // No README found
        }
        throw error;
    }
}

/**
 * Fetches the file tree of the default branch
 * Uses recursive mode to get all files
 */
async function getFileTree(octokit, owner, repo) {
    try {
        // First, get the default branch
        const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
        const defaultBranch = repoData.default_branch;

        // Get the tree recursively
        const { data } = await octokit.rest.git.getTree({
            owner,
            repo,
            tree_sha: defaultBranch,
            recursive: 'true'
        });

        return data.tree || [];
    } catch (error) {
        console.error('Error fetching file tree:', error.message);
        return [];
    }
}

/**
 * Extracts unique file extensions from the file tree
 * @param {Array} tree - Array of tree items from GitHub API
 * @returns {Array<string>} Array of unique file extensions (sorted)
 */
function extractFileExtensions(tree) {
    const extensions = new Set();

    for (const item of tree) {
        // Only process files (blobs), not directories (trees)
        if (item.type === 'blob' && item.path) {
            const filename = item.path.split('/').pop();
            const lastDotIndex = filename.lastIndexOf('.');

            // Only extract extension if there's a dot and it's not at the start
            if (lastDotIndex > 0) {
                const ext = filename.substring(lastDotIndex + 1).toLowerCase();
                extensions.add(ext);
            }
        }
    }

    return Array.from(extensions).sort();
}

/**
 * Fetches the last N commit messages from the repository
 * @param {Octokit} octokit - Authenticated Octokit instance
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {number} count - Number of commits to fetch
 * @returns {Promise<Array>} Array of commit info objects
 */
async function getLastCommits(octokit, owner, repo, count) {
    try {
        const { data } = await octokit.rest.repos.listCommits({
            owner,
            repo,
            per_page: count
        });

        return data.map(commit => ({
            sha: commit.sha.substring(0, 7), // Short SHA
            message: commit.commit.message,
            author: commit.commit.author.name,
            date: commit.commit.author.date,
            url: commit.html_url
        }));
    } catch (error) {
        console.error('Error fetching commits:', error.message);
        return [];
    }
}

/**
 * Fetches the languages used in a repository
 * GET /repos/{owner}/{repo}/languages
 * @param {Octokit} octokit - Authenticated Octokit instance
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {Promise<Object>} Object with languages and their byte counts
 */
async function getRepoLanguages(octokit, owner, repo) {
    try {
        const { data } = await octokit.rest.repos.listLanguages({
            owner,
            repo
        });
        return data; // e.g., { "JavaScript": 12345, "Python": 6789 }
    } catch (error) {
        console.error('Error fetching languages:', error.message);
        return {};
    }
}

module.exports = {
    getUserRepos,
    getRepoDetails
};
