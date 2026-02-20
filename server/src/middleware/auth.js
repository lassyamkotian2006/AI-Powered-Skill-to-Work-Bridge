/**
 * Authentication Middleware
 * -------------------------
 * Protects routes by checking if the user has a valid GitHub access token
 * stored in their session. If not, returns 401 Unauthorized.
 */

/**
 * Middleware to require authentication
 * Checks if the user has a valid access token in their session
 */
function requireAuth(req, res, next) {
    // Check if user has an access token in their session
    if (!req.session || !req.session.accessToken) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Please log in with GitHub first',
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
