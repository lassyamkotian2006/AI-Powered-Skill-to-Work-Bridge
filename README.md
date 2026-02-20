# 🌉 AI-Powered Skill-to-Work Bridge

An AI-driven platform that analyzes your GitHub repositories to understand your real-world skills, recommends suitable job roles, identifies skill gaps, and provides personalized learning paths.

![Node.js](https://img.shields.io/badge/Node.js-18+-green?logo=node.js)
![React](https://img.shields.io/badge/React-18+-blue?logo=react)
![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?logo=supabase)
![License](https://img.shields.io/badge/License-UNLICENSED-red)

## ✨ Features

- **🔐 GitHub OAuth** - Secure login with your GitHub account
- **📊 Repository Analysis** - Automatically scans your repos for technologies used
- **🎯 Skill Extraction** - AI-powered identification of your technical skills
- **💼 Job Matching** - Get matched to suitable job roles based on your skills
- **📈 Gap Analysis** - Identify missing skills for your dream role
- [x] **📚 Learning Paths** - Personalized recommendations to upskill
- [x] **📄 Resume Generation** - AI-powered student-focused resume generator

## 🏗️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, Vite, CSS3 |
| **Backend** | Node.js, Express.js |
| **Database** | Supabase (PostgreSQL) |
| **AI** | Groq API (LLaMA 3) |
| **Auth** | GitHub OAuth 2.0 |

---

## 🚀 Quick Start (Local Development)

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/AI-Powered-Skill-to-Work-Bridge.git
cd AI-Powered-Skill-to-Work-Bridge
```

### 2️⃣ Configure Environment Variables

1. **Server**: `cd server && cp .env.example .env` → Fill in your API keys (Supabase, Groq, GitHub).
2. **Client**: `cd client && cp .env.example .env` (Optional: defaults to `http://localhost:3000`).

### 3️⃣ Run

```bash
# Terminal 1: Backend
cd server && npm install && npm run dev

# Terminal 2: Frontend
cd client && npm install && npm run dev
```

---

## 🚢 Deployment (Single Public Link)

This setup is optimized for **zero-cost** and provides a **single shareable URL** (e.g., `https://your-project.onrender.com`).

### 1️⃣ Create a Production GitHub OAuth App
1. Go to [GitHub Developer Settings](https://github.com/settings/developers).
2. **Homepage URL**: Your Render URL (e.g., `https://skill-bridge.onrender.com`).
3. **Callback URL**: Your Render URL + `/auth/github/callback`.

### 2️⃣ Deploy to Render (Web Service - Free)
1. Create a **Web Service** on [Render](https://render.com).
2. Connect your GitHub repository.
3. **Root Directory**: *Keep this empty* (root of the repo).
4. **Build Command**: `npm run render-build`
5. **Start Command**: `npm start`
6. **Add Environment Variables**:
   - `NODE_ENV`: `production`
   - `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`: From Step 1
   - `SESSION_SECRET`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`, `GROQ_API_KEY`: From your `.env`.

### 3️⃣ That's it!
Your app is now live on a single URL. When you visit the link, Render will build your frontend, start your backend, and serve everything from one place.

---

## 📄 License

This project is **UNLICENSED**.

---

**Built with ❤️ for students bridging the gap from skills to work**
