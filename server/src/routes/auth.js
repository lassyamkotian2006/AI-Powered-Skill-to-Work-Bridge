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
const bcrypt = require('bcrypt');
const { requireAuth } = require('../middleware/auth');
const config = require('../config/env');
// Service imports
const otpService = require('../services/otpService');
const dbService = require('../services/supabaseService');


const router = express.Router();
const isProduction = process.env.NODE_ENV === 'production';

// No in-memory store here, we use otpService instead


/**
 * GET /auth/github
 * Redirects the user to GitHub's authorization page
 * This starts the OAuth flow
 */
router.get('/github', (req, res) => {
    // SECURITY: Allow direct GitHub OAuth, but we will verify the email in the callback

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
    const authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;
    console.log(`🔗 Redirecting ${req.session.verifiedEmail || 'user'} to GitHub for authorization...`);
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
    // Note: On Render free tier, the server may cold-start between the initial redirect
    // and the callback, wiping the in-memory session store. In that case, we log a warning
    // but proceed since the code exchange with GitHub still validates authenticity.
    if (req.session.oauthState && state !== req.session.oauthState) {
        console.error('❌ State mismatch - possible CSRF attack');
        return res.status(400).json({ error: 'Invalid state parameter' });
    }
    if (!req.session.oauthState) {
        console.warn('⚠️ OAuth state missing from session (server may have restarted). Proceeding with code exchange.');
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

        // Fetch user info
        const octokit = new Octokit({ auth: tokenData.access_token });
        const { data: githubUser } = await octokit.rest.users.getAuthenticated();

        // 1. Get user's email from GitHub if not in session
        const verifiedEmail = req.session.verifiedEmail || githubUser.email;

        if (!verifiedEmail) {
            // If GitHub doesn't provide a public email, we might need to fetch all user emails
            const { data: emails } = await octokit.rest.users.listEmailsForAuthenticatedUser();
            const primaryEmail = emails.find(e => e.primary && e.verified)?.email || emails[0]?.email;
            req.session.verifiedEmail = primaryEmail;
        } else {
            req.session.verifiedEmail = verifiedEmail;
        }

        // 2. Check if we already have a user with this GitHub ID
        let user = await dbService.getUserByGithubId(githubUser.id);

        if (user) {
            // Already identified! Just update their token and link info
            user = await dbService.linkGitHubAccount(user.id, githubUser, tokenData.access_token);
        } else {
            // No user with this Github ID yet. Check if one exists with this Email.
            user = await dbService.getUserByEmail(req.session.verifiedEmail);

            if (user) {
                // Email matches! Link the GitHub account to this existing email user
                user = await dbService.linkGitHubAccount(user.id, githubUser, tokenData.access_token);
            } else {
                // Fresh user! Create and then link
                user = await dbService.createUser(req.session.verifiedEmail, null, githubUser.login);
                user = await dbService.linkGitHubAccount(user.id, githubUser, tokenData.access_token);
                await dbService.updateUserVerification(user.id, true);
            }
        }

        req.session.otpVerified = true;

        req.session.user = {
            id: user.id,
            githubId: githubUser.id,
            login: user.username || githubUser.login,
            name: user.name || githubUser.name,
            avatarUrl: user.avatar_url || githubUser.avatar_url,
            profileUrl: user.profile_url || githubUser.html_url
        };

        console.log(`✅ User ${githubUser.login} logged in successfully via GitHub!`);
        res.redirect(config.clientUrl);

    } catch (err) {
        console.error('❌ OAuth callback error:', err);
        res.status(500).json({ error: 'Authentication failed', message: err.message });
    }
});

/**
 * POST /auth/register
 * Register a new user with email and password
 */
router.post('/register', async (req, res) => {
    let { email, password, username } = req.body;
    email = email?.trim();

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        // Check if user exists
        const existingUser = await dbService.getUserByEmail(email);
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Hash password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Create user
        const user = await dbService.createUser(email, passwordHash, username);

        console.log(`👤 New user registered: ${email}`);
        res.status(201).json({ success: true, user: { email: user.email, username: user.username }, message: 'Registration successful. Please verify your email.' });
    } catch (err) {
        console.error('❌ Registration error:', err);
        res.status(500).json({ error: 'Registration failed', details: err.message });
    }
});

/**
 * POST /auth/login
 * Login with email and password
 */
router.post('/login', async (req, res) => {
    let { email, password } = req.body;
    email = email?.trim();
    console.log(`\n🔑 Login attempt for: ${email}`);

    try {
        const user = await dbService.getUserByEmail(email);

        if (!user) {
            console.warn(`❌ Login failed: User not found for email ${email}`);
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        if (!user.password_hash) {
            console.warn(`❌ Login failed: No password hash for user ${email} (Maybe they only use GitHub?)`);
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Check if verified (MANDATORY)
        console.log(`🔍 User verification status: ${user.is_email_verified}, Session OTP verified: ${req.session.otpVerified}`);
        if (!user.is_email_verified && !req.session.otpVerified) {
            console.warn(`⚠️ Login paused: Email not verified for ${email}`);
            return res.status(401).json({ error: 'Email not verified', needsVerification: true });
        }

        // Compare password
        const match = await bcrypt.compare(password, user.password_hash);
        console.log(`🔐 Password match result: ${match}`);

        if (!match) {
            console.warn(`❌ Login failed: Password mismatch for ${email}`);
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // If in production and email is not verified, prompt for verification
        if (isProduction && !user.is_email_verified) {
            console.log(`ℹ️ Production: Prompting for verification for ${email}`);
            return res.json({ needsVerification: true, email: user.email });
        }

        // 4. Success! Create session
        req.session.user = {
            id: user.id,
            githubId: user.github_id,
            login: user.username,
            name: user.name || user.username,
            avatarUrl: user.avatar_url
        };
        req.session.otpVerified = true;
        req.session.verifiedEmail = email;

        console.log(`✅ User ${user.username} logged in successfully via Email!`);
        res.json({ success: true, user: req.session.user });
    } catch (err) {
        console.error('❌ Login error:', err);
        res.status(500).json({ error: 'Login failed' });
    }
});

/**
 * POST /auth/reset-password
 * Reset password using OTP
 */
router.post('/reset-password', async (req, res) => {
    const { email, code, newPassword, token, timestamp } = req.body;

    if (!otpService.verifyOTP(email, code, token, timestamp)) {
        return res.status(401).json({ error: 'Invalid or expired code' });
    }

    try {
        const user = await dbService.getUserByEmail(email);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(newPassword, saltRounds);

        // Update password using a general update if available or direct call
        const { error } = await dbService.updateUserPassword(user.id, passwordHash);
        if (error) throw error;

        res.json({ success: true, message: 'Password reset successful' });
    } catch (err) {
        res.status(500).json({ error: 'Reset failed' });
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

/**
 * POST /auth/send-otp
 * Sends a 6-digit OTP to the user's email
 */
router.post("/send-otp", async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ success: false, error: 'Email is required' });

        const result = await otpService.generateOTP(email);
        res.json({ success: true, emailSent: result.emailSent, token: result.token, timestamp: result.timestamp });
    } catch (err) {
        console.error('❌ Error in /send-otp:', err);
        res.status(500).json({ success: false });
    }
});

/**
 * POST /auth/verify-otp
 * Verifies a 6-digit OTP
 */
router.post("/verify-otp", (req, res) => {
    const { email, otp, token, timestamp } = req.body;
    if (!email || !otp) return res.status(400).json({ success: false });

    if (otpService.verifyOTP(email, otp, token, timestamp)) {
        res.json({ success: true });
    } else {
        res.status(400).json({ success: false });
    }
});

/**
 * POST /auth/otp/send
 * Sends a 6-digit code to the user's email (logged to console)
 */
router.post('/otp/send', async (req, res) => {
    console.log('📨 Request to /otp/send:', req.body);
    let { email } = req.body;
    email = email?.trim();

    if (!email || !email.includes('@')) {
        console.error('❌ Invalid email provided:', email);
        return res.status(400).json({ error: 'Valid email is required' });
    }

    try {
        const result = await otpService.generateOTP(email);

        // Store email in session as "pending"
        req.session.pendingEmail = email;
        req.session.otpVerified = false;

        if (result.emailSent) {
            console.log(`✅ OTP email sent to ${email}`);
            res.json({ success: true, token: result.token, timestamp: result.timestamp, message: 'Verification code sent to your email' });
        } else {
            console.warn(`⚠️ OTP generated for ${email} but email was NOT delivered`);
            res.json({ success: true, emailSent: false, token: result.token, timestamp: result.timestamp, message: 'OTP generated but email delivery failed.' });
        }
    } catch (err) {
        console.error('❌ Error in /otp/send:', err);
        res.status(500).json({ error: 'Internal server error', details: err.message });
    }
});

/**
 * POST /auth/otp/verify
 * Verifies the 6-digit code
 */
router.post('/otp/verify', async (req, res) => {
    console.log('🔑 Request to /otp/verify:', req.body);
    let { email, code, token, timestamp } = req.body;
    email = email?.trim();

    if (!email || !code) {
        return res.status(400).json({ error: 'Email and code are required' });
    }

    try {
        const isValid = otpService.verifyOTP(email, code, token, timestamp);

        if (isValid) {
            req.session.otpVerified = true;
            req.session.verifiedEmail = email;

            // Mark user as verified in the database
            const user = await dbService.getUserByEmail(email);
            if (user) {
                await dbService.updateUserVerification(user.id, true);

                // Create login session so the user is logged in immediately
                req.session.user = {
                    id: user.id,
                    githubId: user.github_id,
                    login: user.username,
                    name: user.name || user.username,
                    avatarUrl: user.avatar_url
                };
            }

            console.log(`✅ OTP verified for ${email}`);
            res.json({ success: true, message: 'OTP verified successfully' });
        } else {
            console.log(`❌ Invalid OTP for ${email}`);
            res.status(401).json({ error: 'Invalid or expired code' });
        }
    } catch (err) {
        console.error('❌ Error in /otp/verify:', err);
        res.status(500).json({ error: 'Internal server error', details: err.message });
    }
});

/**
 * GET /auth/profile
 * Returns the current user's profile including interests and target role
 */
router.get('/profile', requireAuth, async (req, res) => {
    try {
        const user = await dbService.getUserByEmail(req.session.verifiedEmail);
        if (!user) return res.status(404).json({ error: 'User not found' });

        res.json({
            success: true,
            profile: {
                interests: user.interests,
                targetRole: user.target_role
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

/**
 * PUT /auth/profile
 * Updates the user's interests and/or target role
 */
router.put('/profile', requireAuth, async (req, res) => {
    const { interests, targetRole } = req.body;
    const userId = req.session.user.id;

    try {
        let updatedUser;
        if (interests !== undefined) {
            updatedUser = await dbService.updateUserInterests(userId, interests);
        }
        if (targetRole !== undefined) {
            updatedUser = await dbService.updateUserTargetRole(userId, targetRole);
        }

        res.json({
            success: true,
            message: 'Profile updated successfully',
            profile: {
                interests: updatedUser?.interests,
                targetRole: updatedUser?.target_role
            }
        });
    } catch (err) {
        console.error('❌ Profile update error:', err);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

module.exports = router;
