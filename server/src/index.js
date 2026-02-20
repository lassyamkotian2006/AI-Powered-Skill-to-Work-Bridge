/**
 * Express Server Entry Point
 * --------------------------
 * Sets up the Express.js server with:
 * - Session middleware for storing OAuth tokens
 * - CORS for cross-origin requests
 * - Authentication routes (/auth)
 * - Repository routes (/repos)
 */

const express = require('express');
const session = require('express-session');
const cors = require('cors');
const config = require('./config/env');

// Import routes
const authRoutes = require('./routes/auth');
const repoRoutes = require('./routes/repos');
const skillsRoutes = require('./routes/skills');
const jobsRoutes = require('./routes/jobs');
const learningRoutes = require('./routes/learning');
const resumeRoutes = require('./routes/resume');

// Create Express app
const app = express();

const isProduction = process.env.NODE_ENV === 'production';

// Trust proxy for Render/Vercel (needed for secure cookies behind a proxy)
if (isProduction) {
    app.set('trust proxy', 1);
}

/**
 * CORS Configuration
 * Allows cross-origin requests from the frontend
 */
app.use(cors({
    origin: config.clientUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

/**
 * JSON Body Parser
 * Parses incoming JSON request bodies
 */
app.use(express.json());

/**
 * Session Configuration
 * Stores the GitHub access token after OAuth login
 */
app.use(session({
    secret: config.session.secret,
    resave: false,
    saveUninitialized: false,
    proxy: isProduction, // Trust the platform's proxy
    cookie: {
        secure: isProduction, // HTTPS required for sameSite: 'none'
        httpOnly: true,
        sameSite: isProduction ? 'none' : 'lax', // Needed for cross-domain cookies
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// ===========================================
// Routes
// ===========================================

/**
 * Health Check Route
 * Simple endpoint to verify the server is running
 */
app.get('/', (req, res) => {
    res.json({
        message: '🌉 Skill-to-Work Bridge API',
        version: '2.0.0',
        status: 'running',
        endpoints: {
            auth: {
                login: 'GET /auth/github',
                callback: 'GET /auth/github/callback',
                user: 'GET /auth/user',
                logout: 'GET /auth/logout'
            },
            repos: {
                list: 'GET /repos',
                details: 'GET /repos/:owner/:repo/details'
            },
            skills: {
                analyze: 'POST /skills/analyze',
                list: 'GET /skills',
                sync: 'POST /skills/sync',
                summary: 'GET /skills/summary'
            },
            jobs: {
                recommendations: 'GET /jobs/recommendations',
                roles: 'GET /jobs/roles',
                careerPath: 'GET /jobs/career/path'
            },
            learning: {
                path: 'GET /learning/path',
                resources: 'GET /learning/resources/:skillName',
                roadmap: 'GET /learning/roadmap'
            }
        }
    });
});

/**
 * Authentication Routes
 * Handles GitHub OAuth flow
 */
app.use('/auth', authRoutes);

/**
 * Repository Routes
 * Fetches repository data from GitHub
 */
app.use('/repos', repoRoutes);

/**
 * Skills Routes
 * Analyzes repos and extracts technical skills
 */
app.use('/skills', skillsRoutes);

/**
 * Jobs Routes
 * Provides job matching and recommendations
 */
app.use('/jobs', jobsRoutes);

/**
 * Learning Routes
 * Generates personalized learning paths
 */
app.use('/learning', learningRoutes);

/**
 * Resume Routes
 * Generates AI-powered professional resumes
 */
app.use('/resume', resumeRoutes);

// ===========================================
// Error Handling
// ===========================================

/**
 * 404 Handler
 * Catches requests to undefined routes
 */
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} does not exist`
    });
});

/**
 * Global Error Handler
 * Catches any unhandled errors
 */
app.use((err, req, res, next) => {
    console.error('❌ Unhandled error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message
    });
});

// ===========================================
// Start Server
// ===========================================

app.listen(config.port, () => {
    console.log('');
    console.log('===========================================');
    console.log('🌉 Skill-to-Work Bridge API Server');
    console.log('===========================================');
    console.log(`🚀 Server running at: http://localhost:${config.port}`);
    console.log(`🔐 GitHub OAuth Login: http://localhost:${config.port}/auth/github`);
    console.log('');
    console.log('Available endpoints:');
    console.log('  - GET /              API info');
    console.log('  - GET /auth/github   Start OAuth login');
    console.log('  - GET /auth/user     Get logged-in user');
    console.log('  - GET /auth/logout   Logout');
    console.log('  - GET /repos         List your repositories');
    console.log('  - GET /repos/:owner/:repo/details  Get repo details');
    console.log('===========================================');
    console.log('');
});
