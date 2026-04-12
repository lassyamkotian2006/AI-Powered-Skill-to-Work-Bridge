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

/**
 * Keep-Alive Ping Route
 * Lightweight endpoint for uptime monitors (e.g. UptimeRobot)
 * to prevent the Render free-tier service from sleeping.
 * No authentication required.
 */
app.get('/ping', (req, res) => {
    res.status(200).send('Server is awake');
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

const fs = require('fs');

// Serve static files from the React app build folder
const clientDistPath = path.join(__dirname, '../../client/dist');
const indexHtmlPath = path.join(clientDistPath, 'index.html');

// Log the resolved path and check if it exists at startup
console.log(`📂 Client dist path: ${clientDistPath}`);
console.log(`📄 Index HTML path: ${indexHtmlPath}`);
console.log(`📦 Client dist exists: ${fs.existsSync(clientDistPath)}`);
console.log(`📄 Index.html exists: ${fs.existsSync(indexHtmlPath)}`);

if (fs.existsSync(clientDistPath)) {
    // List files in dist for debugging
    const files = fs.readdirSync(clientDistPath);
    console.log(`📁 Files in client/dist: ${files.join(', ')}`);
}

app.use(express.static(clientDistPath));

/**
 * Catch-all Handler
 * For any request that doesn't match an API route, send back the React index.html.
 * This enables SPA client-side routing.
 */
app.get('*', (req, res) => {
    // Only serve index.html for GET requests that expect HTML
    if (req.accepts('html')) {
        if (fs.existsSync(indexHtmlPath)) {
            res.sendFile(indexHtmlPath);
        } else {
            res.status(503).send(`
                <html>
                <head><title>Skill Bridge - Building</title></head>
                <body style="font-family: sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #0a0a0a; color: #fff;">
                    <div style="text-align: center; max-width: 500px;">
                        <h1>🌉 Skill-to-Work Bridge</h1>
                        <p>The frontend is not built yet or the build failed.</p>
                        <p style="color: #888;">If this is a fresh deployment, the build may still be in progress. Please wait a few minutes and try again.</p>
                        <p style="color: #666; font-size: 0.9em;">Expected path: ${clientDistPath}</p>
                        <a href="/api/health" style="color: #4ade80;">Check API Health</a>
                    </div>
                </body>
                </html>
            `);
        }
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

    // Verify email SMTP connection (non-blocking)
    const { verifyConnection } = require('./services/emailService');
    verifyConnection();
});
