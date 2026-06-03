/**
 * Environment Configuration
 * -------------------------
 * Loads and validates all required environment variables.
 * This module centralizes env var access so you can easily see
 * what configuration the app needs.
 */

require('dotenv').config();

// Validate required environment variables.
// IMPORTANT: GitHub OAuth is optional (email/password still works).
// We should NOT crash the whole app if GitHub keys are missing, otherwise Render shows 502.
if (!process.env.SESSION_SECRET) {
  console.error('❌ Missing required environment variable: SESSION_SECRET');
  console.error('Please check your .env file (copy from .env.example)');
  process.exit(1);
}

// Log which optional services are configured
const optionalServices = {
  'Supabase DB': !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY),
  'Groq AI': !!process.env.GROQ_API_KEY,
  'Brevo Email': !!process.env.BREVO_API_KEY,
  'Resend Email': !!process.env.RESEND_API_KEY,
  'Email SMTP (fallback)': !!(process.env.EMAIL_USER && process.env.EMAIL_PASS)
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
    callbackUrl: null, // Always auto-derive from request host for maximum flexibility
    // Scopes we request from GitHub:
    // - read:user: Access user profile information
    // - user:email: Access user email addresses (needed if email is private)
    // - repo: Full access to repositories (needed for README, file tree, commits)
    scopes: ['read:user', 'user:email', 'repo']
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

  // Resend email
  resend: {
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.RESEND_FROM || 'SkillBridge <skilltoworkbridge@gmail.com>'
  },

  // Server port
  port: process.env.PORT || 3000,

  // Frontend URL (for redirects after OAuth) - defaults to root for co-located deployment
  clientUrl: process.env.CLIENT_URL || (process.env.NODE_ENV === 'production' ? '/' : 'http://localhost:5174')
};

