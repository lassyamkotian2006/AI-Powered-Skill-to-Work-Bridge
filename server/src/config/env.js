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
    console.error('Please check your .env file (copy from .env.example)');
    process.exit(1);
  }
}

// Log which optional services are configured
const optionalServices = {
  'Supabase DB': !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY),
  'Groq AI': !!process.env.GROQ_API_KEY
};

console.log('');
console.log('📋 Environment Configuration:');
for (const [service, configured] of Object.entries(optionalServices)) {
  console.log(`   ${configured ? '✅' : '⚠️'}  ${service}: ${configured ? 'Configured' : 'Not configured (optional)'}`);
}
console.log('');

module.exports = {
  // GitHub OAuth credentials
  github: {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackUrl: process.env.CALLBACK_URL ||
      (process.env.RENDER_EXTERNAL_URL
        ? `${process.env.RENDER_EXTERNAL_URL}/auth/github/callback`
        : (process.env.NODE_ENV === 'production' ? null : 'http://localhost:3000/auth/github/callback')),
    // Scopes we request from GitHub:
    // - read:user: Access user profile information
    // - repo: Full access to repositories (needed for README, file tree, commits)
    scopes: ['read:user', 'repo']
  },

  // Session configuration
  session: {
    secret: process.env.SESSION_SECRET
  },

  // Supabase database
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_KEY
  },

  // Groq AI
  groqApiKey: process.env.GROQ_API_KEY,

  // Server port
  port: process.env.PORT || 3000,

  // Frontend URL (for redirects after OAuth) - defaults to root for co-located deployment
  clientUrl: process.env.CLIENT_URL || (process.env.NODE_ENV === 'production' ? '/' : 'http://localhost:5173')
};

