/**
 * Authentication Routes
 * ---------------------
 * Handles GitHub OAuth flow and email/password authentication:
 * - /auth/github - Redirects to GitHub for authorization
 * - /auth/github/callback - Handles the OAuth callback
 * - /auth/register - Register with email/password
 * - /auth/login - Login with email/password
 * - /auth/logout - Destroys the session
 * - /auth/user - Returns logged-in user info
 * - /auth/otp/send - Send OTP to email
 * - /auth/otp/verify - Verify OTP
 * - /auth/reset-password - Reset password with OTP
 * - /auth/profile - Get/update user profile
 */

const express = require('express');
const { Octokit } = require('octokit');
const bcrypt = require('bcrypt');
const { requireAuth } = require('../middleware/auth');
const config = require('../config/env');
const otpService = require('../services/otpService');
const dbService = require('../services/supabaseService');

const router = express.Router();
const isProduction = process.env.NODE_ENV === 'production';

/**
 * GET /auth/github
 * Redirects to GitHub for authorization
 */
router.get('/github', (req, res) => {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const callbackUrl = config.github.callbackUrl || `${protocol}://${host}/auth/github/callback`;

    const params = new URLSearchParams({
        client_id: config.github.clientId,
        redirect_uri: callbackUrl,
        scope: config.github.scopes.join(' '),
        state: generateState()
    });

    req.session.oauthState = params.get('state');

    const authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;
    console.log(`🔗 Redirecting to GitHub for authorization...`);
    res.redirect(authUrl);
});

/**
 * GET /auth/github/callback
 * Handles GitHub OAuth callback
 */
router.get('/github/callback', async (req, res) => {
    const { code, state, error } = req.query;

    if (error) {
        console.error('❌ OAuth error:', error);
        return res.status(400).json({ error: 'Authorization denied', details: error });
    }

    if (req.session.oauthState && state !== req.session.oauthState) {
        console.error('❌ State mismatch - possible CSRF attack');
        return res.status(400).json({ error: 'Invalid state parameter' });
    }
    
    if (!req.session.oauthState) {
        console.warn('⚠️ OAuth state missing (server may have restarted). Proceeding.');
    }

    try {
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.get('host');
        const callbackUrl = config.github.callbackUrl || `${protocol}://${host}/auth/github/callback`;

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

        req.session.accessToken = tokenData.access_token;

        const octokit = new Octokit({ auth: tokenData.access_token });
        const { data: githubUser } = await octokit.rest.users.getAuthenticated();

        const verifiedEmail = req.session.verifiedEmail || githubUser.email;

        if (!verifiedEmail) {
            const { data: emails } = await octokit.rest.users.listEmailsForAuthenticatedUser();
            const primaryEmail = emails.find(e => e.primary && e.verified)?.email || emails[0]?.email;
            req.session.verifiedEmail = primaryEmail;
        } else {
            req.session.verifiedEmail = verifiedEmail;
        }

        let user = await dbService.getUserByGithubId(githubUser.id);

        if (user) {
            user = await dbService.linkGitHubAccount(user.id, githubUser, tokenData.access_token);
        } else {
            user = await dbService.getUserByEmail(req.session.verifiedEmail);

            if (user) {
                user = await dbService.linkGitHubAccount(user.id, githubUser, tokenData.access_token);
            } else {
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

        console.log(`✅ User ${githubUser.login} logged in via GitHub!`);
        res.redirect(config.clientUrl);

    } catch (err) {
        console.error('❌ OAuth callback error:', err);
        res.status(500).json({ error: 'Authentication failed', message: err.message });
    }
});

/**
 * POST /auth/register
 */
router.post('/register', async (req, res) => {
    let { email, password, username } = req.body;
    email = email?.trim();

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    try {
        const existingUser = await dbService.getUserByEmail(email);
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        const user = await dbService.createUser(email, passwordHash, username);

        console.log(`👤 New user registered: ${email}`);
        res.status(201).json({ 
            success: true, 
            user: { email: user.email, username: user.username }, 
            message: 'Registration successful. Please verify your email.' 
        });
    } catch (err) {
        console.error('❌ Registration error:', err);
        res.status(500).json({ error: 'Registration failed', details: err.message });
    }
});

/**
 * POST /auth/login
 */
router.post('/login', async (req, res) => {
    let { email, password } = req.body;
    email = email?.trim();
    console.log(`\n🔑 Login attempt for: ${email}`);

    try {
        const user = await dbService.getUserByEmail(email);

        if (!user) {
            console.warn(`❌ Login failed: User not found for ${email}`);
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        if (!user.password_hash) {
            console.warn(`❌ Login failed: No password for ${email} (GitHub-only account?)`);
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        if (!user.is_email_verified && !req.session.otpVerified) {
            console.warn(`⚠️ Login paused: Email not verified for ${email}`);
            return res.status(401).json({ error: 'Email not verified', needsVerification: true });
        }

        const match = await bcrypt.compare(password, user.password_hash);
        console.log(`🔐 Password match: ${match}`);

        if (!match) {
            console.warn(`❌ Login failed: Wrong password for ${email}`);
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        if (isProduction && !user.is_email_verified) {
            return res.json({ needsVerification: true, email: user.email });
        }

        req.session.user = {
            id: user.id,
            githubId: user.github_id,
            login: user.username,
            name: user.name || user.username,
            avatarUrl: user.avatar_url
        };
        req.session.otpVerified = true;
        req.session.verifiedEmail = email;

        console.log(`✅ User ${user.username} logged in via Email!`);
        res.json({ success: true, user: req.session.user });
    } catch (err) {
        console.error('❌ Login error:', err);
        res.status(500).json({ error: 'Login failed' });
    }
});

/**
 * POST /auth/reset-password
 * FIXED: Verifies OTP and resets password in ONE call
 */
router.post('/reset-password', async (req, res) => {
    const { email, code, newPassword, token, timestamp } = req.body;

    if (!email || !code || !newPassword || !token || !timestamp) {
        return res.status(400).json({ 
            error: 'Missing required fields',
            required: ['email', 'code', 'newPassword', 'token', 'timestamp']
        });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ 
            error: 'Password too short',
            message: 'Password must be at least 6 characters'
        });
    }

    if (!otpService.verifyOTP(email, code, token, timestamp)) {
        return res.status(401).json({ 
            error: 'Invalid or expired code',
            message: 'The verification code is incorrect or has expired. Please request a new one.'
        });
    }

    try {
        const user = await dbService.getUserByEmail(email);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(newPassword, saltRounds);

        await dbService.updateUserPassword(user.id, passwordHash);

        console.log(`✅ Password reset successful for ${email}`);
        res.json({ 
            success: true, 
            message: 'Password reset successful. You can now log in with your new password.'
        });
    } catch (err) {
        console.error('❌ Reset password error:', err);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

/**
 * GET /auth/logout
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
 * POST /auth/otp/send
 * Send OTP to email
 */
router.post('/otp/send', async (req, res) => {
    console.log('📨 Request to /otp/send:', req.body);
    let { email } = req.body;
    email = email?.trim();

    if (!email || !email.includes('@')) {
        console.error('❌ Invalid email:', email);
        return res.status(400).json({ error: 'Valid email is required' });
    }

    try {
        const result = await otpService.generateOTP(email);

        req.session.pendingEmail = email;
        req.session.otpVerified = false;

        if (result.emailSent) {
            console.log(`✅ OTP email sent to ${email}`);
            res.json({ 
                success: true, 
                token: result.token, 
                timestamp: result.timestamp, 
                message: 'Verification code sent to your email' 
            });
        } else {
            console.warn(`⚠️ OTP generated but email NOT delivered`);
            res.json({ 
                success: true, 
                emailSent: false, 
                token: result.token, 
                timestamp: result.timestamp, 
                message: 'OTP generated but email delivery failed. Check server logs for the code.' 
            });
        }
    } catch (err) {
        console.error('❌ Error in /otp/send:', err);
        res.status(500).json({ error: 'Internal server error', details: err.message });
    }
});

/**
 * POST /auth/otp/verify
 * Verify OTP and log user in (for signup/login flow)
 * NOT used for reset flow - reset-password handles its own verification
 */
router.post('/otp/verify', async (req, res) => {
    console.log('🔑 Request to /otp/verify:', { email: req.body.email, hasCode: !!req.body.code });
    let { email, code, token, timestamp } = req.body;
    email = email?.trim();

    if (!email || !code) {
        return res.status(400).json({ error: 'Email and code are required' });
    }

    const formatCheck = otpService.validateOTPFormat(email, code);
    if (!formatCheck.valid) {
        return res.status(400).json({ error: formatCheck.reason });
    }

    try {
        const isValid = otpService.verifyOTP(email, code, token, timestamp);

        if (isValid) {
            req.session.otpVerified = true;
            req.session.verifiedEmail = email;

            const user = await dbService.getUserByEmail(email);
            if (user) {
                await dbService.updateUserVerification(user.id, true);

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
            res.status(401).json({ 
                error: 'Invalid or expired code',
                message: 'The code is incorrect or has expired. Please try again or request a new code.'
            });
        }
    } catch (err) {
        console.error('❌ Error in /otp/verify:', err);
        res.status(500).json({ error: 'Internal server error', details: err.message });
    }
});

/**
 * POST /auth/send-otp (legacy endpoint)
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
 * POST /auth/verify-otp (legacy endpoint)
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
 * GET /auth/profile
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

function generateState() {
    return Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15);
}

module.exports = router;
