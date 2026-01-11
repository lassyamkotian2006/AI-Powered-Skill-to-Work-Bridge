/**
 * Environment Configuration
 * -------------------------
 * Loads and validates all required environment variables.
 * This module centralizes env var access so you can easily see
 * what configuration the app needs.
 */

require('dotenv').config();

// Validate required environment variables
const requiredEnvVars = [
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'SESSION_SECRET'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    console.error('Please check your .env file');
    process.exit(1);
  }
}

module.exports = {
  // GitHub OAuth credentials
  github: {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackUrl: process.env.CALLBACK_URL || 'http://localhost:3000/auth/github/callback',
    // Scopes we request from GitHub:
    // - read:user: Access user profile information
    // - repo: Full access to repositories (needed for README, file tree, commits)
    scopes: ['read:user', 'repo']
  },
  
  // Session configuration
  session: {
    secret: process.env.SESSION_SECRET
  },
  
  // Server port
  port: process.env.PORT || 3000
};
