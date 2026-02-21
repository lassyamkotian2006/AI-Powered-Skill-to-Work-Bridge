/**
 * Authentication Routes
 * ---------------------
 * Handles GitHub OAuth flow:
 * - /auth/github - Redirects to GitHub for authorization
 * - /auth/github/callback - Handles the OAuth callback
 * - /auth/logout - Destroys the session
 * - /auth/user - Returns the logged-in user's info
 */

const express = require('express');
const { Octokit } = require('octokit');
const config = require('../config/env');

const router = express.Router();

/**
 * GET /auth/github
 * Redirects the user to GitHub's authorization page
 * This starts the OAuth flow
 */
router.get('/github', (req, res) => {
    // Dynamically determine the callback URL from the request
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const callbackUrl = config.github.callbackUrl || `${protocol}://${host}/auth/github/callback`;

    // Build the GitHub authorization URL with required parameters
    const params = new URLSearchParams({
        client_id: config.github.clientId,
        redirect_uri: callbackUrl,
        scope: config.github.scopes.join(' '), // 'read:user repo'
        state: generateState() // Random state for CSRF protection
    });

    // Store state in session to verify on callback
    req.session.oauthState = params.get('state');

    // Redirect user to GitHub
    const authUrl = `https://github.com/login/oauth/authorize?${params}`;
    console.log('🔗 Redirecting to GitHub for authorization...');
    res.redirect(authUrl);
});

/**
 * GET /auth/github/callback
 * GitHub redirects here after user authorizes (or denies)
 * We exchange the code for an access token
 */
router.get('/github/callback', async (req, res) => {
    const { code, state, error } = req.query;

    // Handle user denial or errors
    if (error) {
        console.error('❌ OAuth error:', error);
        return res.status(400).json({ error: 'Authorization denied', details: error });
    }

    // Verify the state to prevent CSRF attacks
    if (state !== req.session.oauthState) {
        console.error('❌ State mismatch - possible CSRF attack');
        return res.status(400).json({ error: 'Invalid state parameter' });
    }

    try {
        // Dynamically determine the callback URL from the request
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.get('host');
        const callbackUrl = config.github.callbackUrl || `${protocol}://${host}/auth/github/callback`;

        // Exchange the authorization code for an access token
        const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                client_id: config.github.clientId,
                client_secret: config.github.clientSecret,
                code: code,
                redirect_uri: callbackUrl
            })
        });

        const tokenData = await tokenResponse.json();

        if (tokenData.error) {
            console.error('❌ Token exchange error:', tokenData.error);
            return res.status(400).json({ error: 'Failed to exchange code for token', details: tokenData.error });
        }

        // Store the access token in the session
        req.session.accessToken = tokenData.access_token;

        // Fetch user info and store in session
        const octokit = new Octokit({ auth: tokenData.access_token });
        const { data: user } = await octokit.rest.users.getAuthenticated();

        req.session.user = {
            id: user.id,
            login: user.login,
            name: user.name,
            avatarUrl: user.avatar_url,
            profileUrl: user.html_url
        };

        console.log(`✅ User ${user.login} logged in successfully!`);

        // Redirect back to frontend application after successful login
        res.redirect(config.clientUrl);

    } catch (err) {
        console.error('❌ OAuth callback error:', err);
        res.status(500).json({ error: 'Authentication failed', message: err.message });
    }
});

/**
 * GET /auth/logout
 * Destroys the user's session and logs them out
 */
router.get('/logout', (req, res) => {
    const username = req.session?.user?.login || 'Unknown';

    req.session.destroy((err) => {
        if (err) {
            console.error('❌ Logout error:', err);
            return res.status(500).json({ error: 'Failed to logout' });
        }

        console.log(`👋 User ${username} logged out`);
        res.json({ message: 'Logged out successfully' });
    });
});

/**
 * GET /auth/user
 * Returns the currently logged-in user's information
 */
router.get('/user', (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({
            authenticated: false,
            message: 'Not logged in',
            loginUrl: '/auth/github'
        });
    }

    res.json({
        authenticated: true,
        user: req.session.user
    });
});

/**
 * Generates a random state string for CSRF protection
 */
function generateState() {
    return Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15);
}

module.exports = router;
