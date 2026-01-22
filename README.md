# 🌉 AI-Powered Skill-to-Work Bridge

An AI-driven platform that analyzes your GitHub repositories to understand your real-world skills, recommends suitable job roles, identifies skill gaps, and provides personalized learning paths.

![Node.js](https://img.shields.io/badge/Node.js-18+-green?logo=node.js)
![React](https://img.shields.io/badge/React-18+-blue?logo=react)
![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?logo=supabase)
![License](https://img.shields.io/badge/License-MIT-yellow)

## ✨ Features

- **🔐 GitHub OAuth** - Secure login with your GitHub account
- **📊 Repository Analysis** - Automatically scans your repos for technologies used
- **🎯 Skill Extraction** - AI-powered identification of your technical skills
- **💼 Job Matching** - Get matched to suitable job roles based on your skills
- **📈 Gap Analysis** - Identify missing skills for your dream role
- **📚 Learning Paths** - Personalized recommendations to upskill

## 🏗️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, Vite, CSS3 |
| **Backend** | Node.js, Express.js |
| **Database** | Supabase (PostgreSQL) |
| **AI** | Groq API (LLaMA 3) |
| **Auth** | GitHub OAuth 2.0 |

---

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- [GitHub Account](https://github.com/)
- [Supabase Account](https://supabase.com/) (free tier works)
- [Groq API Key](https://console.groq.com/) (free tier available)

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/AI-Powered-Skill-to-Work-Bridge.git
cd AI-Powered-Skill-to-Work-Bridge
```

### 2️⃣ Set Up Supabase Database

1. Create a new project at [supabase.com](https://supabase.com/dashboard)
2. Go to **SQL Editor** → **New Query**
3. Copy contents of `database/schema.sql` and run it
4. Note your **Project URL** and **API Keys** from Settings → API

### 3️⃣ Create GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Fill in:
   - **Application name**: `Skill-to-Work Bridge`
   - **Homepage URL**: `http://localhost:5173`
   - **Authorization callback URL**: `http://localhost:3000/auth/github/callback`
4. Click **Register application**
5. Copy your **Client ID** and generate a **Client Secret**

### 4️⃣ Configure Environment Variables

```bash
# Server configuration
cd server
cp .env.example .env
```

Edit `server/.env`:

```env
# GitHub OAuth
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Session
SESSION_SECRET=any_random_string_at_least_32_chars

# Server
PORT=3000
CALLBACK_URL=http://localhost:3000/auth/github/callback

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key

# AI (Groq)
GROQ_API_KEY=your-groq-api-key
```

### 5️⃣ Install Dependencies

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 6️⃣ Run the Application

**Terminal 1 - Backend:**
```bash
cd server
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd client
npm run dev
```

### 7️⃣ Open in Browser

- **Frontend**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:3000](http://localhost:3000)

---

## 📡 API Documentation

### Authentication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/github` | GET | Initiate GitHub OAuth login |
| `/auth/github/callback` | GET | OAuth callback handler |
| `/auth/user` | GET | Get current logged-in user |
| `/auth/logout` | GET | Logout and clear session |

### Repositories

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/repos` | GET | List user's GitHub repositories |
| `/repos/:owner/:repo/details` | GET | Get detailed repo info |

### Skills

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/skills/analyze` | POST | Analyze repos and extract skills |
| `/skills` | GET | Get user's extracted skills |
| `/skills/sync` | POST | Sync skills to database |
| `/skills/summary` | GET | Get skill summary by category |

### Jobs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/jobs/recommendations` | GET | Get job recommendations |
| `/jobs/roles` | GET | List all available job roles |
| `/jobs/career/path` | GET | Get career path suggestions |

### Learning

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/learning/path` | GET | Get personalized learning path |
| `/learning/resources/:skill` | GET | Get resources for a skill |
| `/learning/roadmap` | GET | Get complete learning roadmap |

---

## 📁 Project Structure

```
AI-Powered-Skill-to-Work-Bridge/
├── client/                 # React frontend
│   ├── src/
│   │   ├── App.jsx        # Main application
│   │   ├── App.css        # Component styles
│   │   └── index.css      # Global styles
│   └── package.json
├── server/                 # Node.js backend
│   ├── src/
│   │   ├── config/        # Configuration files
│   │   ├── middleware/    # Auth middleware
│   │   ├── routes/        # API routes
│   │   │   ├── auth.js    # OAuth routes
│   │   │   ├── repos.js   # Repository routes
│   │   │   ├── skills.js  # Skills routes
│   │   │   ├── jobs.js    # Jobs routes
│   │   │   └── learning.js# Learning routes
│   │   ├── services/      # Business logic
│   │   │   ├── ai.js      # AI/Groq integration
│   │   │   ├── github.js  # GitHub API
│   │   │   ├── jobMatcher.js
│   │   │   └── supabaseService.js
│   │   └── index.js       # Server entry point
│   ├── .env.example
│   └── package.json
├── database/
│   └── schema.sql         # Database schema + seed data
└── README.md
```

---

## 🚢 Deployment

### Deploy Backend (Railway/Render)

1. Push code to GitHub
2. Connect repo to [Railway](https://railway.app) or [Render](https://render.com)
3. Set environment variables in dashboard
4. Deploy!

**Environment variables for production:**
```env
NODE_ENV=production
PORT=3000
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx
CALLBACK_URL=https://your-backend.railway.app/auth/github/callback
SUPABASE_URL=xxx
SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_KEY=xxx
GROQ_API_KEY=xxx
SESSION_SECRET=xxx
```

### Deploy Frontend (Vercel)

1. Connect repo to [Vercel](https://vercel.com)
2. Set root directory to `client`
3. Update `API_URL` in `App.jsx` to your backend URL
4. Deploy!

---

## 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| OAuth redirect error | Verify callback URL matches exactly in GitHub settings |
| Database connection fails | Check Supabase URL and keys in `.env` |
| AI analysis fails | Verify Groq API key is valid |
| CORS errors | Ensure backend CORS allows frontend origin |

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

**Built with ❤️ for students bridging the gap from skills to work**
