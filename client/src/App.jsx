import { useState, useEffect } from 'react'
import './App.css'

// API Base URL - In production, we use a relative path because the frontend is served by the backend
const API_URL = import.meta.env.MODE === 'production'
  ? ''
  : (import.meta.env.VITE_API_URL || 'http://localhost:3000')

function App() {
  const [user, setUser] = useState(null)
  const [activeTab, setActiveTab] = useState('skills')
  const [loading, setLoading] = useState(true)
  const [skills, setSkills] = useState([])
  const [jobs, setJobs] = useState([])
  const [interests, setInterests] = useState('')
  const [learningPath, setLearningPath] = useState([])
  const [analyzing, setAnalyzing] = useState(false)
  const [showAssistant, setShowAssistant] = useState(false)
  const [resumeData, setResumeData] = useState(null)
  const [generatingResume, setGeneratingResume] = useState(false)
  const [showResumePage, setShowResumePage] = useState(false)

  // Check if user is logged in
  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch(`${API_URL}/auth/user`, { credentials: 'include' })
      const data = await res.json()
      if (data.authenticated) {
        setUser(data.user)
        loadDashboardData()
      }
    } catch (err) {
      console.log('Not authenticated')
    }
    setLoading(false)
  }

  const loadDashboardData = async () => {
    try {
      const [skillsRes, jobsRes, learningRes] = await Promise.all([
        fetch(`${API_URL}/skills`, { credentials: 'include' }),
        fetch(`${API_URL}/jobs/recommendations`, { credentials: 'include' }),
        fetch(`${API_URL}/learning/path`, { credentials: 'include' })
      ])

      const skillsData = await skillsRes.json()
      const jobsData = await jobsRes.json()
      const learningData = await learningRes.json()

      if (skillsData.skills && skillsData.skills.length > 0) setSkills(skillsData.skills)
      if (jobsData.recommendations) setJobs(jobsData.recommendations)
      if (learningData.learningPath) setLearningPath(learningData.learningPath)
    } catch (err) {
      console.error('Error loading dashboard:', err)
    }
  }

  const analyzeSkills = async () => {
    setAnalyzing(true)
    try {
      await fetch(`${API_URL}/skills/sync`, { method: 'POST', credentials: 'include' })
      const res = await fetch(`${API_URL}/skills/analyze`, { method: 'POST', credentials: 'include' })
      const data = await res.json()

      if (data.success) {
        setSkills(data.skills || [])
        loadDashboardData()
      }
    } catch (err) {
      console.error('Error analyzing skills:', err)
    }
    setAnalyzing(false)
  }

  const login = () => {
    window.location.href = `${API_URL}/auth/github`
  }

  const logout = async () => {
    await fetch(`${API_URL}/auth/logout`, { credentials: 'include' })
    setUser(null)
    setSkills([])
    setJobs([])
    setLearningPath([])
  }

  if (loading) {
    return (
      <div className="app-container">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <LoginPage onLogin={login} />
  }

  // Full-page resume view
  if (showResumePage && resumeData) {
    return (
      <ResumeFullPage
        resume={resumeData}
        onBack={() => setShowResumePage(false)}
      />
    )
  }

  return (
    <div className="app-container">
      <Header user={user} onLogout={logout} />
      <NavTabs activeTab={activeTab} setActiveTab={setActiveTab} isAnalyzed={skills.length > 0} />

      <div className="tab-content">
        <div className="card mb-3 interest-card" style={{ padding: '1.25rem', border: '1px solid var(--purple-20)', background: 'var(--bg-card)' }}>
          <div className="flex items-center gap-1 mb-1">
            <span style={{ fontSize: '1.2rem' }}>🎯</span>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>Career Interests</h3>
          </div>
          <p className="text-muted mb-2" style={{ fontSize: '0.85rem' }}>Tell me what roles or industries you're aiming for (e.g. "Fintech", "Cloud Native", "AI Solutions").</p>
          <input
            type="text"
            className="form-input"
            placeholder="Search roles or enter interests..."
            value={interests}
            onChange={(e) => setInterests(e.target.value)}
            style={{ width: '100%', padding: '0.6rem 0.75rem', fontSize: '0.9rem' }}
          />
        </div>
        {activeTab === 'skills' && (
          <SkillsTab
            skills={skills}
            onAnalyze={analyzeSkills}
            analyzing={analyzing}
          />
        )}

        {activeTab === 'jobs' && (
          <JobsTab jobs={jobs} />
        )}

        {activeTab === 'learning' && (
          <LearningTab learningPath={learningPath} />
        )}

        {activeTab === 'resume' && (
          <ResumeTab
            skills={skills}
            user={user}
            setResumeData={setResumeData}
            generating={generatingResume}
            setGenerating={setGeneratingResume}
            setShowResumePage={setShowResumePage}
          />
        )}
      </div>

      <AIAssistant
        show={showAssistant}
        onToggle={() => setShowAssistant(!showAssistant)}
        skills={skills}
        jobs={jobs}
        interests={interests}
      />
    </div>
  )
}

// =============================================
// LOGIN PAGE
// =============================================

function LoginPage({ onLogin }) {
  const [isSignup, setIsSignup] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleAuth = (e) => {
    e.preventDefault()
    setError('')

    if (!email || !password) {
      setError('Please fill in all fields to proceed.')
      return
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email address.')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    // Since this is a bridge to GitHub, we "verify" then proceed to OAuth
    onLogin()
  }

  return (
    <div className="login-body">
      <div className="login-card-modern">
        <div className="login-header">
          <div className="login-icon-box">
            <span className="material-symbols-outlined" style={{ fontSize: '36px', color: 'white' }}>auto_awesome</span>
          </div>
          <h2 className="login-title">{isSignup ? 'Create Account' : 'Skill-to-Work'}</h2>
          <p className="login-subtitle">{isSignup ? 'Sign up to build your career bridge' : 'AI-powered career intelligence'}</p>
        </div>

        <div className="login-content">
          <form onSubmit={handleAuth}>
            {error && <div className="login-error-toast">{error}</div>}

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div className="input-wrapper">
                <span className="material-symbols-outlined input-icon">mail</span>
                <input
                  className="form-input"
                  placeholder="name@university.edu"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <div className="form-actions">
                <label className="form-label">Password</label>
                {!isSignup && <a className="forgot-link" href="#">Forgot?</a>}
              </div>
              <div className="input-wrapper">
                <span className="material-symbols-outlined input-icon">lock</span>
                <input
                  className="form-input"
                  placeholder="••••••••"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {isSignup && (
              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <div className="input-wrapper">
                  <span className="material-symbols-outlined input-icon">shield</span>
                  <input className="form-input" placeholder="••••••••" type="password" />
                </div>
              </div>
            )}

            <button className="btn-signin" type="submit">
              {isSignup ? 'Sign Up' : 'Sign In'}
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </form>

          <div className="divider">
            <div className="divider-line"></div>
            <span className="divider-text">Or Continue with</span>
            <div className="divider-line"></div>
          </div>

          <div>
            <button className="btn-github-modern" onClick={handleAuth}>
              <svg viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"></path>
              </svg>
              Connect with GitHub
            </button>
            <p className="helper-text">
              Secure authentication via GitHub for technical project mapping.
            </p>
          </div>
        </div>

        <div className="login-footer">
          <p className="footer-text">
            {isSignup ? 'Already have an account?' : "Don't have an account?"}
            <button
              className="footer-link-btn"
              onClick={() => setIsSignup(!isSignup)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginLeft: '0.25rem' }}
            >
              {isSignup ? 'Sign In' : 'Create Account'}
            </button>
          </p>
        </div>
      </div>

      <div className="security-badge">
        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>verified_user</span>
        <span className="security-text">Secure OAuth 2.0 Authentication</span>
      </div>
    </div>
  )
}

// =============================================
// HEADER
// =============================================

function Header({ user, onLogout }) {
  return (
    <header className="header">
      <div className="logo">
        <div className="logo-icon">
          <span className="material-symbols-outlined" style={{ color: 'white', fontSize: '22px' }}>auto_awesome</span>
        </div>
        <span className="logo-text">SkillBridge</span>
      </div>
      <div className="user-info">
        <span>{user.name || user.login}</span>
        <img className="user-avatar" src={user.avatarUrl} alt={user.login} />
        <button className="btn btn-secondary" onClick={onLogout}>Logout</button>
      </div>
    </header>
  )
}

// =============================================
// NAVIGATION
// =============================================

function NavTabs({ activeTab, setActiveTab, isAnalyzed }) {
  const tabs = [
    { id: 'skills', label: 'Skills', icon: 'psychology' },
    { id: 'jobs', label: 'Jobs', icon: 'work_outline', locked: !isAnalyzed },
    { id: 'learning', label: 'Learning', icon: 'school', locked: !isAnalyzed },
    { id: 'resume', label: 'Resume', icon: 'description', locked: !isAnalyzed },
  ]

  return (
    <nav className="nav-tabs">
      {tabs.map(tab => (
        <button
          key={tab.id}
          className={`nav-tab ${activeTab === tab.id ? 'active' : ''} ${tab.locked ? 'locked' : ''}`}
          onClick={() => !tab.locked && setActiveTab(tab.id)}
          title={tab.locked ? 'Analyze your repository first to unlock this feature' : ''}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
            {tab.locked ? 'lock' : tab.icon}
          </span>
          {tab.label}
        </button>
      ))}
    </nav>
  )
}

// =============================================
// SKILLS TAB - ENHANCED
// =============================================

function SkillsTab({ skills, onAnalyze, analyzing }) {
  const groupByCategory = (skills) => {
    return skills.reduce((acc, skill) => {
      const category = skill.category || 'other'
      if (!acc[category]) acc[category] = []
      acc[category].push(skill)
      return acc
    }, {})
  }

  const grouped = groupByCategory(skills)
  const categories = Object.keys(grouped)

  // Code quality signals based on skills
  const codeQualitySignals = skills.length > 0 ? [
    { label: 'Project Completeness', status: skills.length >= 5 ? 'good' : 'neutral', icon: '📦' },
    { label: 'Tech Diversity', status: categories.length >= 3 ? 'good' : 'neutral', icon: '🎨' },
    { label: 'Modern Stack', status: skills.some(s => ['React', 'TypeScript', 'Docker'].includes(s.name)) ? 'good' : 'improve', icon: '⚡' },
  ] : []

  return (
    <div className="skills-tab">
      <div className="section-header flex justify-between items-center mb-3">
        <div>
          <h2>Your Skills</h2>
          <p className="text-muted">{skills.length} skills detected from your repositories</p>
          {skills.length > 0 && (
            <span className="how-calculated">
              ℹ️ How was this calculated?
            </span>
          )}
        </div>
        <button
          className={`btn btn-primary ${analyzing ? 'ai-shimmer' : ''}`}
          onClick={onAnalyze}
          disabled={analyzing}
        >
          {analyzing ? (
            <>
              <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }}></div>
              Analyzing...
            </>
          ) : (
            <>🔎 Analyze Repos</>
          )}
        </button>
      </div>

      {skills.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-icon">🔎</div>
          <h3>No skills analyzed yet</h3>
          <p className="text-muted">Click "Analyze Repos" to scan your GitHub repositories and extract your technical skills using AI.</p>
        </div>
      ) : (
        <>
          {/* Code Quality Signals */}
          {codeQualitySignals.length > 0 && (
            <div className="quality-badges mb-3">
              {codeQualitySignals.map((signal, i) => (
                <span key={i} className={`quality-badge ${signal.status}`}>
                  {signal.icon} {signal.label}
                </span>
              ))}
            </div>
          )}

          <div className="grid-2">
            {categories.map(category => (
              <div key={category} className="card">
                <h3 className="mb-2" style={{ textTransform: 'capitalize' }}>
                  {getCategoryIcon(category)} {category}
                </h3>
                <div className="flex flex-wrap gap-1">
                  {grouped[category].map((skill, i) => (
                    <EnhancedSkillBadge key={i} skill={skill} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function EnhancedSkillBadge({ skill }) {
  const [showTooltip, setShowTooltip] = useState(false)

  const levelConfig = {
    expert: { color: 'var(--success)', label: 'Expert', percent: 100 },
    advanced: { color: 'var(--info)', label: 'Advanced', percent: 85 },
    intermediate: { color: 'var(--warning)', label: 'Intermediate', percent: 60 },
    beginner: { color: 'var(--error)', label: 'Beginner', percent: 25 }
  }

  const config = levelConfig[skill.level] || levelConfig.intermediate

  return (
    <div
      className="tooltip-wrapper"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="skill-badge-enhanced">
        <div className="skill-info">
          <span className="skill-name">{skill.name}</span>
          <span className="skill-level">{config.label}</span>
        </div>
        <div className="confidence-bar">
          <div
            className={`confidence-fill ${skill.level || 'intermediate'}`}
            style={{ width: `${config.percent}%`, background: config.color }}
          />
        </div>
      </div>
      {showTooltip && (
        <div className="tooltip">
          <strong>{skill.name}</strong> • {config.label}<br />
          <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>
            Based on code complexity & usage frequency
          </span>
        </div>
      )}
    </div>
  )
}

function getCategoryIcon(category) {
  const icons = {
    language: '💻',
    framework: '⚡',
    database: '🗄️',
    tool: '🔧',
    cloud: '☁️',
    concept: '💡'
  }
  return icons[category] || '📦'
}

// =============================================
// JOBS TAB - ENHANCED
// =============================================

function JobsTab({ jobs }) {
  const [selectedRole, setSelectedRole] = useState(null)

  return (
    <div className="jobs-tab">
      <div className="section-header mb-3">
        <h2>Job Recommendations</h2>
        <p className="text-muted">Based on your skill profile • Powered by AI matching</p>
      </div>

      {jobs.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-icon">💼</div>
          <h3>No direct matches yet</h3>
          <p className="text-muted">
            Analyze your GitHub skills to see your match score!
            <br />
            Our AI Advisor can still suggest roles in the chat based on your interests.
          </p>
        </div>
      ) : (
        <div className="grid-2">
          {jobs.map((job, i) => (
            <EnhancedJobCard
              key={i}
              job={job}
              rank={i + 1}
              onPreview={() => setSelectedRole(job)}
            />
          ))}
        </div>
      )}

      {/* Role Simulation Modal */}
      {selectedRole && (
        <RoleSimulationModal
          role={selectedRole}
          onClose={() => setSelectedRole(null)}
        />
      )}
    </div>
  )
}

function EnhancedJobCard({ job, rank, onPreview }) {
  const [expanded, setExpanded] = useState(false)

  const getScoreClass = (score) => {
    if (score >= 80) return 'excellent'
    if (score >= 60) return 'good'
    if (score >= 40) return 'moderate'
    return 'low'
  }

  const scoreClass = getScoreClass(job.score)
  const circumference = 2 * Math.PI * 28
  const offset = circumference - (job.score / 100) * circumference

  return (
    <div className="card job-card-enhanced">
      <div className="job-header">
        <div>
          <span className="badge badge-primary mb-1">#{rank} Match</span>
          <h3 className="job-title">{job.title}</h3>
          <p className="job-meta">
            {job.experienceLevel} • ${(job.salaryRange?.min / 1000).toFixed(0)}k - ${(job.salaryRange?.max / 1000).toFixed(0)}k
          </p>
        </div>

        {/* Animated Progress Ring */}
        <div className="progress-ring">
          <svg viewBox="0 0 64 64">
            <circle className="progress-ring-bg" cx="32" cy="32" r="28" />
            <circle
              className={`progress-ring-fill ${scoreClass}`}
              cx="32" cy="32" r="28"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <span className="progress-ring-text">{job.score}%</span>
        </div>
      </div>

      {/* Skill Breakdown */}
      <div className="skill-breakdown">
        {job.matchingSkills?.length > 0 && (
          <div className="skill-category">
            <span className="skill-category-label">✅ Matched</span>
            {job.matchingSkills.slice(0, 4).map((skill, i) => (
              <span key={i} className="skill-pill matched">{skill}</span>
            ))}
          </div>
        )}

        {job.missingSkills?.length > 0 && (
          <div className="skill-category">
            <span className="skill-category-label">📚 To Learn</span>
            {job.missingSkills.slice(0, 3).map((skill, i) => (
              <span key={i} className="skill-pill missing">
                {typeof skill === 'string' ? skill : skill.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Roadmap to 100% Section */}
      {job.roadmap && job.roadmap.steps.length > 0 && (
        <div className="roadmap-preview mt-2" style={{ padding: '1rem', background: 'rgba(124, 58, 237, 0.05)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--purple-20)' }}>
          <div className="flex items-center gap-1 mb-1">
            <span style={{ fontSize: '1rem' }}>🚀</span>
            <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--purple-light)' }}>Roadmap to 100%</h4>
          </div>
          <div className="roadmap-steps">
            {job.roadmap.steps.slice(0, 2).map((step, i) => (
              <div key={i} className="roadmap-step-mini" style={{ marginBottom: '0.75rem' }}>
                <div className="flex justify-between items-center mb-05">
                  <span className="step-name" style={{ fontSize: '0.85rem', fontWeight: 500 }}>{step.skill}</span>
                  <span className="step-time" style={{ fontSize: '0.75rem', opacity: 0.7 }}>~{step.estimatedHours}h</span>
                </div>
                <div className="mini-progress-bar" style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div className="mini-progress-fill" style={{ height: '100%', width: '0%', background: 'var(--purple)', transition: 'width 1s ease' }}></div>
                </div>
              </div>
            ))}
            {job.roadmap.steps.length > 2 && (
              <p className="text-muted mt-1" style={{ fontSize: '0.75rem' }}>
                +{job.roadmap.steps.length - 2} more skills to master
              </p>
            )}
          </div>
        </div>
      )}

      {/* AI Explanation Panel */}
      <div className="ai-explanation">
        <div
          className="ai-explanation-header"
          onClick={() => setExpanded(!expanded)}
        >
          <span>✨</span>
          <span>Why this role fits you</span>
          <span style={{ marginLeft: 'auto' }}>{expanded ? '▲' : '▼'}</span>
        </div>
        {expanded && (
          <div className="ai-explanation-content">
            {job.aiRecommendation || `Your ${job.matchingSkills?.slice(0, 2).join(' and ')} experience aligns well with ${job.title} requirements. Focus on mastering the ${job.roadmap?.steps?.[0]?.skill || 'remaining topics'} to reach 100% qualification.`}
          </div>
        )}
      </div>

      {/* Preview Role Button */}
      <button
        className="btn btn-secondary mt-2"
        style={{ width: '100%' }}
        onClick={onPreview}
      >
        👀 Preview This Role
      </button>
    </div>
  )
}

// =============================================
// ROLE SIMULATION MODAL
// =============================================

function RoleSimulationModal({ role, onClose }) {
  const roleData = getRoleSimulationData(role.title)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>{role.title}</h3>
            <p className="text-muted">Role Preview</p>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="role-section">
            <h4>📋 Daily Tasks</h4>
            <ul className="role-list">
              {roleData.dailyTasks.map((task, i) => (
                <li key={i}>📌 {task}</li>
              ))}
            </ul>
          </div>

          <div className="role-section">
            <h4>🛠️ Common Tools</h4>
            <div className="flex flex-wrap gap-1">
              {roleData.tools.map((tool, i) => (
                <span key={i} className="tool-tag">{tool}</span>
              ))}
            </div>
          </div>

          <div className="role-section">
            <h4>🎯 Key Responsibilities</h4>
            <ul className="role-list">
              {roleData.responsibilities.map((resp, i) => (
                <li key={i}>▸ {resp}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

function getRoleSimulationData(title) {
  const roleDatabase = {
    'Frontend Developer': {
      dailyTasks: ['Build responsive UI components', 'Review pull requests', 'Fix browser compatibility issues', 'Attend sprint planning'],
      tools: ['React', 'VS Code', 'Chrome DevTools', 'Figma', 'Git', 'npm'],
      responsibilities: ['Translate designs into code', 'Optimize web performance', 'Maintain component libraries', 'Collaborate with designers']
    },
    'Backend Developer': {
      dailyTasks: ['Design API endpoints', 'Write database queries', 'Debug server issues', 'Code review'],
      tools: ['Node.js', 'PostgreSQL', 'Docker', 'Postman', 'Git', 'AWS'],
      responsibilities: ['Build scalable APIs', 'Manage databases', 'Implement security', 'Write documentation']
    },
    'Full Stack Developer': {
      dailyTasks: ['Develop end-to-end features', 'Deploy applications', 'Monitor production', 'Mentor juniors'],
      tools: ['React', 'Node.js', 'PostgreSQL', 'Docker', 'AWS', 'Git'],
      responsibilities: ['Own features from design to deployment', 'Optimize full stack performance', 'Make architectural decisions']
    },
    'DevOps Engineer': {
      dailyTasks: ['Manage CI/CD pipelines', 'Monitor infrastructure', 'Automate deployments', 'Incident response'],
      tools: ['Docker', 'Kubernetes', 'AWS', 'Terraform', 'Jenkins', 'Prometheus'],
      responsibilities: ['Ensure system reliability', 'Automate infrastructure', 'Implement security practices']
    }
  }

  return roleDatabase[title] || {
    dailyTasks: ['Work on technical projects', 'Collaborate with team', 'Solve complex problems', 'Continuous learning'],
    tools: ['Git', 'VS Code', 'Slack', 'Jira', 'Cloud platforms'],
    responsibilities: ['Deliver quality code', 'Meet project deadlines', 'Communicate effectively', 'Stay updated with tech trends']
  }
}

// =============================================
// LEARNING TAB - ENHANCED
// =============================================

function LearningTab({ learningPath }) {
  return (
    <div className="learning-tab">
      <div className="section-header mb-3">
        <h2>Your Learning Path</h2>
        <p className="text-muted">Skills to learn for your target jobs • Personalized roadmap</p>
      </div>

      {learningPath.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-icon">📚</div>
          <h3>No learning path yet</h3>
          <p className="text-muted">Analyze your skills to generate a personalized learning roadmap.</p>
        </div>
      ) : (
        <div className="learning-timeline-enhanced">
          {learningPath.map((step, i) => (
            <EnhancedLearningStep key={i} step={step} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}

function EnhancedLearningStep({ step, index }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="learning-step-enhanced">
      <div className={`step-indicator ${step.status || 'pending'}`}>
        {step.status === 'completed' ? '' : index + 1}
      </div>

      <div className="learning-card-enhanced" onClick={() => setExpanded(!expanded)}>
        <div className="flex justify-between items-center">
          <div>
            <div className="flex gap-1 mb-1">
              <span className="badge badge-primary">Step {index + 1}</span>
              {step.projectBased && <span className="project-badge">🔨 Project-Based</span>}
            </div>
            <h3>{step.skill}</h3>
            <p className="text-muted">Target: {step.targetLevel} level</p>
          </div>
          <div className="time-badge">
            ⏱️ {step.estimatedHours}h
          </div>
        </div>

        {step.neededFor?.length > 0 && (
          <p className="text-muted mt-2" style={{ fontSize: '0.8rem' }}>
            🎯 Needed for: {step.neededFor.join(', ')}
          </p>
        )}

        {expanded && (
          <div className="mt-2" style={{ animation: 'fadeIn 0.3s ease' }}>
            <h4 className="mb-1">📚 Learning Resources:</h4>
            {(step.resources || step.suggestedResources || []).map((resource, i) => (
              <a
                key={i}
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="resource-link card mb-1"
                onClick={(e) => e.stopPropagation()}
                style={{ display: 'block', padding: '0.75rem' }}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <strong>{resource.title}</strong>
                    <p className="text-muted" style={{ fontSize: '0.75rem' }}>
                      {resource.platform} • {resource.type} • {resource.duration}
                    </p>
                  </div>
                  <span>→</span>
                </div>
              </a>
            ))}
          </div>
        )}

        <div className="mt-2 text-muted" style={{ fontSize: '0.75rem', textAlign: 'right' }}>
          {expanded ? 'Click to collapse ▲' : 'Click to see resources ▼'}
        </div>
      </div>
    </div>
  )
}

// =============================================
// RESUME TAB (Student-focused)
// =============================================

function ResumeTab({ skills, user, setResumeData, generating, setGenerating, setShowResumePage }) {
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: '',
    phone: '',
    linkedin: '',
    portfolio: '',
    education: [{ institution: '', degree: '', startYear: '', endYear: '', gpa: '', coursework: '' }],
    internships: [{ company: '', role: '', startDate: '', endDate: '', description: '' }],
    projects: [{ name: '', description: '', technologies: '' }],
    cocurricular: [{ activity: '', role: '', description: '' }],
    certifications: ['']
  })

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const updateArrayField = (section, index, field, value) => {
    setFormData(prev => {
      const arr = [...prev[section]]
      arr[index] = typeof arr[index] === 'string' ? value : { ...arr[index], [field]: value }
      return { ...prev, [section]: arr }
    })
  }

  const addEntry = (section) => {
    const templates = {
      education: { institution: '', degree: '', startYear: '', endYear: '', gpa: '', coursework: '' },
      internships: { company: '', role: '', startDate: '', endDate: '', description: '' },
      projects: { name: '', description: '', technologies: '' },
      cocurricular: { activity: '', role: '', description: '' },
      certifications: ''
    }
    setFormData(prev => ({ ...prev, [section]: [...prev[section], templates[section]] }))
  }

  const removeEntry = (section, index) => {
    setFormData(prev => ({
      ...prev,
      [section]: prev[section].filter((_, i) => i !== index)
    }))
  }

  const generateResume = async () => {
    setGenerating(true)
    try {
      const res = await fetch(`${API_URL}/resume/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          personalInfo: {
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            linkedin: formData.linkedin,
            portfolio: formData.portfolio
          },
          education: formData.education.filter(e => e.institution || e.degree),
          internships: formData.internships.filter(e => e.company || e.role),
          projects: formData.projects.filter(p => p.name || p.description),
          cocurricular: formData.cocurricular.filter(a => a.activity || a.role),
          certifications: formData.certifications.filter(c => c.trim()),
          skills: skills.map(s => ({ name: s.name, category: s.category, level: s.level }))
        })
      })
      const data = await res.json()
      if (data.success) {
        setResumeData(data.resume)
        setShowResumePage(true)
      }
    } catch (err) {
      console.error('Resume generation error:', err)
    }
    setGenerating(false)
  }

  return (
    <div className="resume-tab">
      <div className="section-header mb-3">
        <h2>📄 Resume Generator</h2>
        <p className="text-muted">Fill in your details • Skills auto-populated from GitHub • AI polishes your resume</p>
      </div>

      {/* Personal Info */}
      <div className="card resume-section mb-2">
        <h3 className="mb-2">👤 Personal Information</h3>
        <div className="resume-form-grid">
          <div className="resume-field">
            <label>Full Name *</label>
            <input value={formData.name} onChange={e => updateField('name', e.target.value)} placeholder="Your full name" />
          </div>
          <div className="resume-field">
            <label>Email *</label>
            <input value={formData.email} onChange={e => updateField('email', e.target.value)} placeholder="you@email.com" type="email" />
          </div>
          <div className="resume-field">
            <label>Phone</label>
            <input value={formData.phone} onChange={e => updateField('phone', e.target.value)} placeholder="+91 98765 43210" />
          </div>
          <div className="resume-field">
            <label>LinkedIn</label>
            <input value={formData.linkedin} onChange={e => updateField('linkedin', e.target.value)} placeholder="linkedin.com/in/yourname" />
          </div>
          <div className="resume-field">
            <label>Portfolio Website</label>
            <input value={formData.portfolio} onChange={e => updateField('portfolio', e.target.value)} placeholder="yoursite.dev" />
          </div>
        </div>
      </div>

      {/* Education */}
      <div className="card resume-section mb-2">
        <div className="flex justify-between items-center mb-2">
          <h3>🎓 Education</h3>
          <button className="btn-add" onClick={() => addEntry('education')}>+ Add</button>
        </div>
        {formData.education.map((edu, i) => (
          <div key={i} className="resume-entry">
            {formData.education.length > 1 && (
              <button className="btn-remove" onClick={() => removeEntry('education', i)}>✕</button>
            )}
            <div className="resume-form-grid">
              <div className="resume-field">
                <label>Institution</label>
                <input value={edu.institution} onChange={e => updateArrayField('education', i, 'institution', e.target.value)} placeholder="University / College" />
              </div>
              <div className="resume-field">
                <label>Degree</label>
                <input value={edu.degree} onChange={e => updateArrayField('education', i, 'degree', e.target.value)} placeholder="B.Tech Computer Science" />
              </div>
              <div className="resume-field">
                <label>Start Year</label>
                <input value={edu.startYear} onChange={e => updateArrayField('education', i, 'startYear', e.target.value)} placeholder="2021" />
              </div>
              <div className="resume-field">
                <label>End Year</label>
                <input value={edu.endYear} onChange={e => updateArrayField('education', i, 'endYear', e.target.value)} placeholder="2025" />
              </div>
              <div className="resume-field">
                <label>GPA / Percentage</label>
                <input value={edu.gpa} onChange={e => updateArrayField('education', i, 'gpa', e.target.value)} placeholder="8.5 / 10" />
              </div>
              <div className="resume-field">
                <label>Relevant Coursework</label>
                <input value={edu.coursework} onChange={e => updateArrayField('education', i, 'coursework', e.target.value)} placeholder="Data Structures, OS, DBMS..." />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Internships */}
      <div className="card resume-section mb-2">
        <div className="flex justify-between items-center mb-2">
          <h3>💼 Internships</h3>
          <button className="btn-add" onClick={() => addEntry('internships')}>+ Add</button>
        </div>
        {formData.internships.map((int, i) => (
          <div key={i} className="resume-entry">
            {formData.internships.length > 1 && (
              <button className="btn-remove" onClick={() => removeEntry('internships', i)}>✕</button>
            )}
            <div className="resume-form-grid">
              <div className="resume-field">
                <label>Company / Organization</label>
                <input value={int.company} onChange={e => updateArrayField('internships', i, 'company', e.target.value)} placeholder="Company Name" />
              </div>
              <div className="resume-field">
                <label>Role</label>
                <input value={int.role} onChange={e => updateArrayField('internships', i, 'role', e.target.value)} placeholder="Web Development Intern" />
              </div>
              <div className="resume-field">
                <label>Start Date</label>
                <input value={int.startDate} onChange={e => updateArrayField('internships', i, 'startDate', e.target.value)} placeholder="May 2024" />
              </div>
              <div className="resume-field">
                <label>End Date</label>
                <input value={int.endDate} onChange={e => updateArrayField('internships', i, 'endDate', e.target.value)} placeholder="Jul 2024" />
              </div>
            </div>
            <div className="resume-field mt-1">
              <label>Description</label>
              <textarea value={int.description} onChange={e => updateArrayField('internships', i, 'description', e.target.value)} placeholder="What did you work on? What was the impact?" rows={3} />
            </div>
          </div>
        ))}
      </div>

      {/* Projects */}
      <div className="card resume-section mb-2">
        <div className="flex justify-between items-center mb-2">
          <h3>🚀 Projects</h3>
          <button className="btn-add" onClick={() => addEntry('projects')}>+ Add</button>
        </div>
        {formData.projects.map((proj, i) => (
          <div key={i} className="resume-entry">
            {formData.projects.length > 1 && (
              <button className="btn-remove" onClick={() => removeEntry('projects', i)}>✕</button>
            )}
            <div className="resume-form-grid">
              <div className="resume-field">
                <label>Project Name</label>
                <input value={proj.name} onChange={e => updateArrayField('projects', i, 'name', e.target.value)} placeholder="My Awesome Project" />
              </div>
              <div className="resume-field">
                <label>Technologies</label>
                <input value={proj.technologies} onChange={e => updateArrayField('projects', i, 'technologies', e.target.value)} placeholder="React, Node.js, MongoDB" />
              </div>
            </div>
            <div className="resume-field mt-1">
              <label>Description</label>
              <textarea value={proj.description} onChange={e => updateArrayField('projects', i, 'description', e.target.value)} placeholder="Describe the project and your contributions..." rows={2} />
            </div>
          </div>
        ))}
      </div>

      {/* Co-curricular Activities */}
      <div className="card resume-section mb-2">
        <div className="flex justify-between items-center mb-2">
          <h3>🏆 Co-curricular Activities</h3>
          <button className="btn-add" onClick={() => addEntry('cocurricular')}>+ Add</button>
        </div>
        {formData.cocurricular.map((act, i) => (
          <div key={i} className="resume-entry">
            {formData.cocurricular.length > 1 && (
              <button className="btn-remove" onClick={() => removeEntry('cocurricular', i)}>✕</button>
            )}
            <div className="resume-form-grid">
              <div className="resume-field">
                <label>Activity / Organization</label>
                <input value={act.activity} onChange={e => updateArrayField('cocurricular', i, 'activity', e.target.value)} placeholder="Coding Club, Hackathon, NSS..." />
              </div>
              <div className="resume-field">
                <label>Your Role</label>
                <input value={act.role} onChange={e => updateArrayField('cocurricular', i, 'role', e.target.value)} placeholder="President, Volunteer, Participant" />
              </div>
            </div>
            <div className="resume-field mt-1">
              <label>Description</label>
              <textarea value={act.description} onChange={e => updateArrayField('cocurricular', i, 'description', e.target.value)} placeholder="What did you do? Any achievements?" rows={2} />
            </div>
          </div>
        ))}
      </div>

      {/* Certifications */}
      <div className="card resume-section mb-2">
        <div className="flex justify-between items-center mb-2">
          <h3>📜 Certifications</h3>
          <button className="btn-add" onClick={() => addEntry('certifications')}>+ Add</button>
        </div>
        {formData.certifications.map((cert, i) => (
          <div key={i} className="resume-entry resume-entry-inline">
            {formData.certifications.length > 1 && (
              <button className="btn-remove" onClick={() => removeEntry('certifications', i)}>✕</button>
            )}
            <div className="resume-field" style={{ flex: 1 }}>
              <label>Certification</label>
              <input value={cert} onChange={e => updateArrayField('certifications', i, null, e.target.value)} placeholder="AWS Cloud Practitioner, Google Analytics..." />
            </div>
          </div>
        ))}
      </div>

      {/* Skills (auto-populated) */}
      <div className="card resume-section mb-2">
        <h3 className="mb-2">🛠️ Technical Skills {skills.length > 0 && <span className="badge badge-success">Auto-detected from GitHub</span>}</h3>
        {skills.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {skills.map((skill, i) => (
              <span key={i} className="skill-pill matched">{skill.name}</span>
            ))}
          </div>
        ) : (
          <p className="text-muted">Go to the Skills tab and click "Analyze Repos" first to auto-populate your skills.</p>
        )}
      </div>

      {/* Generate Button */}
      <button
        className={`btn btn-primary generate-resume-btn ${generating ? 'ai-shimmer' : ''}`}
        onClick={generateResume}
        disabled={generating || !formData.name}
      >
        {generating ? (
          <>
            <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }}></div>
            AI is generating your resume...
          </>
        ) : (
          <>✨ Generate Resume</>
        )}
      </button>
    </div>
  )
}

// =============================================
// FULL-PAGE RESUME VIEW
// =============================================

function ResumeFullPage({ resume, onBack }) {
  const handleDownload = () => {
    window.print()
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="resume-full-page">
      <div className="resume-full-page-toolbar no-print">
        <button className="btn btn-secondary" onClick={onBack}>
          ✏️ Edit
        </button>
        <h3>Your Resume</h3>
        <div className="flex gap-1">
          <button className="btn btn-primary" onClick={handleDownload}>
            📥 Download PDF
          </button>
          <button className="btn btn-secondary" onClick={handlePrint}>
            🖨️ Print
          </button>
        </div>
      </div>
      <div className="resume-full-page-body">
        <div className="resume-preview" id="resume-print">
          {/* Header */}
          <div className="resume-header">
            <h1 className="resume-name">{resume.personalInfo?.name}</h1>
            <div className="resume-contact">
              {resume.personalInfo?.email && <span>{resume.personalInfo.email}</span>}
              {resume.personalInfo?.phone && <span>{resume.personalInfo.phone}</span>}
              {resume.personalInfo?.linkedin && <span>{resume.personalInfo.linkedin}</span>}
              {resume.personalInfo?.github && <span>{resume.personalInfo.github}</span>}
              {resume.personalInfo?.portfolio && <span>{resume.personalInfo.portfolio}</span>}
            </div>
          </div>

          {/* Objective / Summary */}
          {resume.summary && (
            <div className="resume-section-block">
              <h2 className="resume-section-title">Objective</h2>
              <p className="resume-summary-text">{resume.summary}</p>
            </div>
          )}

          {/* Education */}
          {resume.education && resume.education.length > 0 && resume.education[0].institution && (
            <div className="resume-section-block">
              <h2 className="resume-section-title">Education</h2>
              {resume.education.map((edu, i) => (
                <div key={i} className="resume-item">
                  <div className="resume-item-header">
                    <div>
                      <strong>{edu.degree}</strong>
                      <span className="resume-item-org"> — {edu.institution}</span>
                    </div>
                    <span className="resume-item-date">{edu.duration}</span>
                  </div>
                  {edu.details && <p className="resume-item-detail">{edu.details}</p>}
                </div>
              ))}
            </div>
          )}

          {/* Technical Skills */}
          {resume.skillCategories && resume.skillCategories.length > 0 && (
            <div className="resume-section-block">
              <h2 className="resume-section-title">Technical Skills</h2>
              <div className="resume-skills-grid">
                {resume.skillCategories.map((cat, i) => (
                  <div key={i} className="resume-skill-row">
                    <strong className="resume-skill-cat">{cat.category}:</strong>
                    <span>{cat.skills.join(', ')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Internships */}
          {resume.internships && resume.internships.length > 0 && resume.internships[0].company && (
            <div className="resume-section-block">
              <h2 className="resume-section-title">Internships</h2>
              {resume.internships.map((int, i) => (
                <div key={i} className="resume-item">
                  <div className="resume-item-header">
                    <div>
                      <strong>{int.role}</strong>
                      <span className="resume-item-org"> — {int.company}</span>
                    </div>
                    <span className="resume-item-date">{int.duration}</span>
                  </div>
                  {int.bullets && (
                    <ul className="resume-bullets">
                      {int.bullets.map((b, j) => <li key={j}>{b}</li>)}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Projects */}
          {resume.projects && resume.projects.length > 0 && resume.projects[0].name && (
            <div className="resume-section-block">
              <h2 className="resume-section-title">Projects</h2>
              {resume.projects.map((proj, i) => (
                <div key={i} className="resume-item">
                  <div className="resume-item-header">
                    <strong>{proj.name}</strong>
                    {proj.technologies && <span className="resume-item-date">{proj.technologies}</span>}
                  </div>
                  {proj.bullets && (
                    <ul className="resume-bullets">
                      {proj.bullets.map((b, j) => <li key={j}>{b}</li>)}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Co-curricular */}
          {resume.cocurricular && resume.cocurricular.length > 0 && resume.cocurricular[0].activity && (
            <div className="resume-section-block">
              <h2 className="resume-section-title">Co-curricular Activities</h2>
              {resume.cocurricular.map((act, i) => (
                <div key={i} className="resume-item">
                  <div className="resume-item-header">
                    <div>
                      <strong>{act.activity}</strong>
                      {act.role && <span className="resume-item-org"> — {act.role}</span>}
                    </div>
                  </div>
                  {act.bullets && (
                    <ul className="resume-bullets">
                      {act.bullets.map((b, j) => <li key={j}>{b}</li>)}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Certifications */}
          {resume.certifications && resume.certifications.length > 0 && (
            <div className="resume-section-block">
              <h2 className="resume-section-title">Certifications</h2>
              <ul className="resume-bullets">
                {resume.certifications.map((cert, i) => (
                  <li key={i}>{cert}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


// =============================================
// AI ASSISTANT WIDGET
// =============================================

function AIAssistant({ show, onToggle, skills, jobs, interests }) {
  const [messages, setMessages] = useState([
    { type: 'bot', text: "Hi! I'm your AI Career Assistant. Tell me your interests and I can help you reach 100% match for any role! What's on your mind?" }
  ])
  const [isTyping, setIsTyping] = useState(false)

  const quickQuestions = [
    "What should I learn next?",
    "Explain my career roadmap",
    "How do I reach 100% match?",
    "Best role for my interests?"
  ]

  const handleQuestion = async (question) => {
    setMessages(prev => [...prev, { type: 'user', text: question }])
    setIsTyping(true)

    try {
      const response = await generateAIResponse(question, interests)
      setMessages(prev => [...prev, { type: 'bot', text: response }])
    } catch (err) {
      setMessages(prev => [...prev, { type: 'bot', text: "I'm having a little trouble connecting. Please try again in a moment!" }])
    } finally {
      setIsTyping(false)
    }
  }

  return (
    <>
      <button className="ai-assistant-toggle" onClick={onToggle}>
        {show ? '✕' : '🤖'}
      </button>

      {show && (
        <div className="ai-assistant-panel">
          <div className="ai-panel-header">
            <span>🤖</span>
            <h4>AI Career Assistant</h4>
          </div>

          <div className="ai-panel-body">
            {messages.map((msg, i) => (
              <div key={i} className={`ai-message ${msg.type}`}>
                {msg.text}
              </div>
            ))}
            {isTyping && (
              <div className="ai-message bot">
                <div className="typing-indicator">
                  <span></span><span></span><span></span>
                </div>
              </div>
            )}
          </div>

          <div className="quick-questions">
            {quickQuestions.map((q, i) => (
              <button key={i} className="quick-btn" onClick={() => handleQuestion(q)}>
                {q}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

async function generateAIResponse(question, interests) {
  try {
    const res = await fetch(`${API_URL}/ai/career-advice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ question, interests })
    })
    const data = await res.json()
    return data.success ? data.advice : "I'm sorry, I couldn't get career advice for you right now."
  } catch (err) {
    console.error('AI Advice Error:', err)
    return "I recommend looking at your roadmap to 100% and focusing on the core skills listed there!"
  }
}

export default App
