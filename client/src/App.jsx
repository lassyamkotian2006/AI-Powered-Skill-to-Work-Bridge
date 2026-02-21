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
  const [learningPath, setLearningPath] = useState([])
  const [analyzing, setAnalyzing] = useState(false)
  const [showAssistant, setShowAssistant] = useState(false)

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

      if (skillsData.skills) setSkills(skillsData.skills)
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

  return (
    <div className="app-container">
      <Header user={user} onLogout={logout} />
      <NavTabs activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="tab-content">
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
      </div>

      {/* AI Assistant Widget */}
      <AIAssistant
        show={showAssistant}
        onToggle={() => setShowAssistant(!showAssistant)}
        skills={skills}
        jobs={jobs}
      />
    </div>
  )
}

// =============================================
// LOGIN PAGE
// =============================================

function LoginPage({ onLogin }) {
  return (
    <div className="login-body">
      <div className="indigo-glow"></div>
      <div className="blob-1"></div>
      <div className="blob-2"></div>

      <div className="login-card-modern">
        <div className="login-header">
          <div className="login-icon-box">
            <span className="material-symbols-outlined" style={{ fontSize: '36px', color: 'white' }}>auto_awesome</span>
          </div>
          <h2 className="login-title">Skill-to-Work</h2>
          <p className="login-subtitle">AI-powered career intelligence</p>
        </div>

        <div className="login-content">
          <form onSubmit={(e) => e.preventDefault()}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div className="input-wrapper">
                <span className="material-symbols-outlined input-icon">mail</span>
                <input className="form-input" placeholder="name@university.edu" type="email" readOnly />
              </div>
            </div>

            <div className="form-group">
              <div className="form-actions">
                <label className="form-label">Password</label>
                <a className="forgot-link" href="#">Forgot?</a>
              </div>
              <div className="input-wrapper">
                <span className="material-symbols-outlined input-icon">lock</span>
                <input className="form-input" placeholder="ΓÇóΓÇóΓÇóΓÇóΓÇóΓÇóΓÇóΓÇó" type="password" readOnly />
              </div>
            </div>

            <button className="btn-signin" type="button">
              Sign In
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </form>

          <div className="divider">
            <div className="divider-line"></div>
            <span className="divider-text">Skill Mapping</span>
            <div className="divider-line"></div>
          </div>

          <div>
            <button className="btn-github-modern" onClick={onLogin}>
              <svg viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"></path>
              </svg>
              Connect with GitHub
            </button>
            <p className="helper-text">
              Automatically map technical projects using our specialized AI extraction.
            </p>
          </div>
        </div>

        <div className="login-footer">
          <p className="footer-text">
            Don't have an account?
            <a className="footer-link" href="#">Create Account</a>
          </p>
        </div>
      </div>

      <div className="security-badge">
        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>verified_user</span>
        <span className="security-text">Secure AES-256 Authentication</span>
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
        <span className="logo-icon">≡ƒîë</span>
        <span className="logo-text">Skill-to-Work Bridge</span>
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

function NavTabs({ activeTab, setActiveTab }) {
  const tabs = [
    { id: 'skills', label: '≡ƒÄ» Skills', icon: '≡ƒÄ»' },
    { id: 'jobs', label: '≡ƒÆ╝ Jobs', icon: '≡ƒÆ╝' },
    { id: 'learning', label: '≡ƒôÜ Learning', icon: '≡ƒôÜ' },
  ]

  return (
    <nav className="nav-tabs">
      {tabs.map(tab => (
        <button
          key={tab.id}
          className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => setActiveTab(tab.id)}
        >
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
    { label: 'Project Completeness', status: skills.length >= 5 ? 'good' : 'neutral', icon: '≡ƒôª' },
    { label: 'Tech Diversity', status: categories.length >= 3 ? 'good' : 'neutral', icon: '≡ƒÄ¿' },
    { label: 'Modern Stack', status: skills.some(s => ['React', 'TypeScript', 'Docker'].includes(s.name)) ? 'good' : 'improve', icon: 'ΓÜí' },
  ] : []

  return (
    <div className="skills-tab">
      <div className="section-header flex justify-between items-center mb-3">
        <div>
          <h2>Your Skills</h2>
          <p className="text-muted">{skills.length} skills detected from your repositories</p>
          {skills.length > 0 && (
            <span className="how-calculated">
              Γä╣∩╕Å How was this calculated?
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
            <>≡ƒöì Analyze Repos</>
          )}
        </button>
      </div>

      {skills.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-icon">≡ƒöì</div>
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
          <strong>{skill.name}</strong> ΓÇó {config.label}<br />
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
    language: '≡ƒÆ╗',
    framework: 'ΓÜí',
    database: '≡ƒùä∩╕Å',
    tool: '≡ƒöº',
    cloud: 'Γÿü∩╕Å',
    concept: '≡ƒÆí'
  }
  return icons[category] || '≡ƒôª'
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
        <p className="text-muted">Based on your skill profile ΓÇó Powered by AI matching</p>
      </div>

      {jobs.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-icon">≡ƒÆ╝</div>
          <h3>No job matches yet</h3>
          <p className="text-muted">Analyze your skills first to get personalized job recommendations.</p>
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
            {job.experienceLevel} ΓÇó ${(job.salaryRange?.min / 1000).toFixed(0)}k - ${(job.salaryRange?.max / 1000).toFixed(0)}k
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
            <span className="skill-category-label">Γ£à Matched</span>
            {job.matchingSkills.slice(0, 4).map((skill, i) => (
              <span key={i} className="skill-pill matched">{skill}</span>
            ))}
          </div>
        )}

        {job.missingSkills?.length > 0 && (
          <div className="skill-category">
            <span className="skill-category-label">≡ƒôÜ To Learn</span>
            {job.missingSkills.slice(0, 3).map((skill, i) => (
              <span key={i} className="skill-pill missing">
                {typeof skill === 'string' ? skill : skill.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* AI Explanation Panel */}
      <div className="ai-explanation">
        <div
          className="ai-explanation-header"
          onClick={() => setExpanded(!expanded)}
        >
          <span>Γ£¿</span>
          <span>Why this role fits you</span>
          <span style={{ marginLeft: 'auto' }}>{expanded ? 'Γû▓' : 'Γû╝'}</span>
        </div>
        {expanded && (
          <div className="ai-explanation-content">
            {job.aiRecommendation || `Your ${job.matchingSkills?.slice(0, 2).join(' and ')} experience aligns well with ${job.title} requirements. Focus on learning ${job.missingSkills?.[0]?.name || 'additional skills'} to strengthen your profile.`}
          </div>
        )}
      </div>

      {/* Preview Role Button */}
      <button
        className="btn btn-secondary mt-2"
        style={{ width: '100%' }}
        onClick={onPreview}
      >
        ≡ƒæü∩╕Å Preview This Role
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
          <button className="modal-close" onClick={onClose}>├ù</button>
        </div>

        <div className="modal-body">
          <div className="role-section">
            <h4>≡ƒôï Daily Tasks</h4>
            <ul className="role-list">
              {roleData.dailyTasks.map((task, i) => (
                <li key={i}>≡ƒôî {task}</li>
              ))}
            </ul>
          </div>

          <div className="role-section">
            <h4>≡ƒ¢á∩╕Å Common Tools</h4>
            <div className="flex flex-wrap gap-1">
              {roleData.tools.map((tool, i) => (
                <span key={i} className="tool-tag">{tool}</span>
              ))}
            </div>
          </div>

          <div className="role-section">
            <h4>≡ƒÄ» Key Responsibilities</h4>
            <ul className="role-list">
              {roleData.responsibilities.map((resp, i) => (
                <li key={i}>Γû╕ {resp}</li>
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
        <p className="text-muted">Skills to learn for your target jobs ΓÇó Personalized roadmap</p>
      </div>

      {learningPath.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-icon">≡ƒôÜ</div>
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
              {step.projectBased && <span className="project-badge">≡ƒö¿ Project-Based</span>}
            </div>
            <h3>{step.skill}</h3>
            <p className="text-muted">Target: {step.targetLevel} level</p>
          </div>
          <div className="time-badge">
            ΓÅ▒∩╕Å {step.estimatedHours}h
          </div>
        </div>

        {step.neededFor?.length > 0 && (
          <p className="text-muted mt-2" style={{ fontSize: '0.8rem' }}>
            ≡ƒÄ» Needed for: {step.neededFor.join(', ')}
          </p>
        )}

        {expanded && (
          <div className="mt-2" style={{ animation: 'fadeIn 0.3s ease' }}>
            <h4 className="mb-1">≡ƒôÜ Learning Resources:</h4>
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
                      {resource.platform} ΓÇó {resource.type} ΓÇó {resource.duration}
                    </p>
                  </div>
                  <span>ΓåÆ</span>
                </div>
              </a>
            ))}
          </div>
        )}

        <div className="mt-2 text-muted" style={{ fontSize: '0.75rem', textAlign: 'right' }}>
          {expanded ? 'Click to collapse Γû▓' : 'Click to see resources Γû╝'}
        </div>
      </div>
    </div>
  )
}

// =============================================
// AI ASSISTANT WIDGET
// =============================================

function AIAssistant({ show, onToggle, skills, jobs }) {
  const [messages, setMessages] = useState([
    { type: 'bot', text: "Hi! I'm your AI Career Assistant. I can help explain your skill analysis and job recommendations. What would you like to know?" }
  ])
  const [isTyping, setIsTyping] = useState(false)

  const quickQuestions = [
    "Why these job recommendations?",
    "What should I learn next?",
    "How long to reach my goal?",
    "Explain my skill gaps"
  ]

  const handleQuestion = (question) => {
    setMessages(prev => [...prev, { type: 'user', text: question }])
    setIsTyping(true)

    setTimeout(() => {
      const response = generateAIResponse(question, skills, jobs)
      setMessages(prev => [...prev, { type: 'bot', text: response }])
      setIsTyping(false)
    }, 1500)
  }

  return (
    <>
      <button className="ai-assistant-toggle" onClick={onToggle}>
        {show ? 'Γ£ò' : '≡ƒñû'}
      </button>

      {show && (
        <div className="ai-assistant-panel">
          <div className="ai-panel-header">
            <span>≡ƒñû</span>
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

function generateAIResponse(question, skills, jobs) {
  const topJob = jobs[0]
  const skillCount = skills.length

  if (question.includes('job') || question.includes('recommendation')) {
    return `Based on your ${skillCount} detected skills, I've matched you with roles that align with your experience. ${topJob ? `'${topJob.title}' is your top match at ${topJob.score}% because your skills in ${topJob.matchingSkills?.slice(0, 2).join(' and ')} directly meet the requirements.` : 'Analyze your repos to get personalized recommendations.'}`
  }

  if (question.includes('learn') || question.includes('next')) {
    const missingSkill = topJob?.missingSkills?.[0]
    return `I recommend focusing on ${missingSkill?.name || 'expanding your skillset'}. This will help you improve your match score for ${topJob?.title || 'target roles'}. Start with online tutorials and build a small project to demonstrate your new skill.`
  }

  if (question.includes('long') || question.includes('time') || question.includes('goal')) {
    return `Based on typical learning curves, reaching a strong match (80%+) for your target roles could take 2-4 months of consistent learning. Focus on 1-2 skills at a time, dedicating about 10 hours per week. Project-based learning accelerates this significantly!`
  }

  if (question.includes('gap') || question.includes('missing')) {
    const gaps = topJob?.missingSkills?.slice(0, 3).map(s => typeof s === 'string' ? s : s.name) || []
    return gaps.length > 0
      ? `Your main skill gaps for ${topJob?.title} are: ${gaps.join(', ')}. These are commonly required skills that employers look for. I recommend prioritizing them in order.`
      : `Great news! You have a strong skill match. Focus on deepening your expertise in your current skills and staying updated with industry trends.`
  }

  return `I can help explain your skill analysis, job recommendations, and learning path. Try asking about specific job matches or what skills to learn next!`
}

export default App
