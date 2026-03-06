/**
 * Authentication Middleware
 * -------------------------
 * Protects routes by checking if the user has a valid session.
 * Accepts either GitHub OAuth (accessToken) or email-based login (user object).
 */

/**
 * Middleware to require authentication
 * Checks if the user has a valid session via GitHub token OR email login
 */
function requireAuth(req, res, next) {
    // Accept either GitHub accessToken or email-based user session
    if (!req.session || (!req.session.accessToken && !req.session.user)) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Please log in first',
            loginUrl: '/auth/github'
        });
    }

    // User is authenticated, proceed to the next middleware/route
    next();
}

/**
 * Middleware to optionally attach user info
 * Doesn't block the request, just attaches user data if available
 */
function optionalAuth(req, res, next) {
    // Just proceed - the route handler can check req.session.accessToken
    next();
}

module.exports = {
    requireAuth,
    optionalAuth
};
