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
const aiRoutes = require('./routes/ai');

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
app.get('/api/health', (req, res) => {
    res.json({
        message: '🌉 Skill-to-Work Bridge API',
        version: '2.0.0',
        status: 'running'
    });
});

const path = require('path');

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

/**
 * AI Career Advice Routes
 * Intelligent career guidance
 */
app.use('/ai', aiRoutes);

// ===========================================
// Serve Frontend (Production)
// ===========================================

// Serve static files from the React app build folder
const clientDistPath = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));

/**
 * Catch-all Handler
 * For any request that doesn't match an API route, send back the React index.html.
 * This enables SPA client-side routing.
 */
app.get('*', (req, res) => {
    // Only serve index.html for GET requests that expect HTML
    if (req.accepts('html')) {
        res.sendFile(path.join(clientDistPath, 'index.html'));
    } else {
        res.status(404).json({
            error: 'Not Found',
            message: `Route ${req.method} ${req.path} does not exist`
        });
    }
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
    const baseUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${config.port}`;
    console.log(`🚀 Server running at: ${baseUrl}`);
    console.log(`🔐 GitHub OAuth Login: ${baseUrl}/auth/github`);
    console.log(`📡 Callback URL: ${config.github.callbackUrl}`);
    console.log(`🌐 Client URL: ${config.clientUrl}`);
    console.log('===========================================');
    console.log('');
});
