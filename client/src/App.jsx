import { useState, useEffect } from 'react'
import './App.css'

// API Base URL
const API_URL = 'http://localhost:3000'

function App() {
  const [user, setUser] = useState(null)
  const [activeTab, setActiveTab] = useState('skills')
  const [loading, setLoading] = useState(true)
  const [skills, setSkills] = useState([])
  const [jobs, setJobs] = useState([])
  const [learningPath, setLearningPath] = useState([])
  const [analyzing, setAnalyzing] = useState(false)

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
      // Load skills
      const skillsRes = await fetch(`${API_URL}/skills`, { credentials: 'include' })
      const skillsData = await skillsRes.json()
      if (skillsData.success) setSkills(skillsData.skills || [])

      // Load job recommendations
      const jobsRes = await fetch(`${API_URL}/jobs/recommendations`, { credentials: 'include' })
      const jobsData = await jobsRes.json()
      if (jobsData.success) setJobs(jobsData.recommendations || [])

      // Load learning path
      const learningRes = await fetch(`${API_URL}/learning/path`, { credentials: 'include' })
      const learningData = await learningRes.json()
      if (learningData.success) setLearningPath(learningData.learningPath || [])
    } catch (err) {
      console.log('Error loading data:', err)
    }
  }

  const analyzeSkills = async () => {
    setAnalyzing(true)
    try {
      // First sync data
      await fetch(`${API_URL}/skills/sync`, { method: 'POST', credentials: 'include' })

      // Then analyze skills
      const res = await fetch(`${API_URL}/skills/analyze`, { method: 'POST', credentials: 'include' })
      const data = await res.json()

      if (data.success) {
        setSkills(data.skills || [])
        // Reload other data
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
  )
}

// =============================================
// LOGIN PAGE
// =============================================

function LoginPage({ onLogin }) {
  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-icon">🌉</div>
        <h1>Skill-to-Work Bridge</h1>
        <p className="text-muted mb-3">
          Analyze your GitHub repos, discover your skills, and find your perfect job match
        </p>
        <button className="btn btn-primary btn-large" onClick={onLogin}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
          </svg>
          Continue with GitHub
        </button>
        <div className="features mt-3">
          <div className="feature">✨ AI-Powered Skill Analysis</div>
          <div className="feature">💼 Smart Job Matching</div>
          <div className="feature">📚 Personalized Learning Paths</div>
        </div>
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
        <span className="logo-icon">🌉</span>
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
    { id: 'skills', label: '🎯 Skills', icon: '🎯' },
    { id: 'jobs', label: '💼 Jobs', icon: '💼' },
    { id: 'learning', label: '📚 Learning', icon: '📚' },
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
// SKILLS TAB
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

  return (
    <div className="skills-tab">
      <div className="section-header flex justify-between items-center mb-3">
        <div>
          <h2>Your Skills</h2>
          <p className="text-muted">{skills.length} skills detected from your repositories</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={onAnalyze}
          disabled={analyzing}
        >
          {analyzing ? (
            <>
              <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }}></div>
              Analyzing...
            </>
          ) : (
            <>🔍 Analyze Repos</>
          )}
        </button>
      </div>

      {skills.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-icon">🔍</div>
          <h3>No skills analyzed yet</h3>
          <p className="text-muted">Click "Analyze Repos" to scan your GitHub repositories and extract your technical skills.</p>
        </div>
      ) : (
        <div className="grid-2">
          {categories.map(category => (
            <div key={category} className="card">
              <h3 className="mb-2" style={{ textTransform: 'capitalize' }}>
                {getCategoryIcon(category)} {category}
              </h3>
              <div className="flex flex-wrap gap-1">
                {grouped[category].map((skill, i) => (
                  <SkillBadge key={i} skill={skill} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SkillBadge({ skill }) {
  const levelColors = {
    expert: 'badge-success',
    advanced: 'badge-primary',
    intermediate: 'badge-warning',
    beginner: ''
  }

  return (
    <span className={`skill-tag ${levelColors[skill.level] || ''}`}>
      {skill.name}
      {skill.level && <span className="text-muted" style={{ marginLeft: 4, fontSize: '0.7rem' }}>
        ({skill.level})
      </span>}
    </span>
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
// JOBS TAB
// =============================================

function JobsTab({ jobs }) {
  return (
    <div className="jobs-tab">
      <div className="section-header mb-3">
        <h2>Job Recommendations</h2>
        <p className="text-muted">Based on your skill profile</p>
      </div>

      {jobs.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-icon">💼</div>
          <h3>No job matches yet</h3>
          <p className="text-muted">Analyze your skills first to get personalized job recommendations.</p>
        </div>
      ) : (
        <div className="grid-2">
          {jobs.map((job, i) => (
            <JobCard key={i} job={job} rank={i + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

function JobCard({ job, rank }) {
  const getScoreClass = (score) => {
    if (score >= 80) return 'excellent'
    if (score >= 60) return 'good'
    if (score >= 40) return 'moderate'
    return 'low'
  }

  return (
    <div className="card job-card">
      <div className="job-header">
        <div>
          <span className="badge badge-primary mb-1">#{rank} Match</span>
          <h3 className="job-title">{job.title}</h3>
          <p className="job-meta">
            {job.experienceLevel} • ${(job.salaryRange?.min / 1000).toFixed(0)}k - ${(job.salaryRange?.max / 1000).toFixed(0)}k
          </p>
        </div>
        <div className={`score-circle ${getScoreClass(job.score)}`}>
          {job.score}%
        </div>
      </div>

      {job.matchingSkills?.length > 0 && (
        <div className="mb-2">
          <p className="text-muted mb-1" style={{ fontSize: '0.8rem' }}>✅ Your matching skills:</p>
          <div className="job-skills">
            {job.matchingSkills.slice(0, 5).map((skill, i) => (
              <span key={i} className="skill-tag">{skill}</span>
            ))}
          </div>
        </div>
      )}

      {job.missingSkills?.length > 0 && (
        <div>
          <p className="text-muted mb-1" style={{ fontSize: '0.8rem' }}>📚 Skills to learn:</p>
          <div className="job-skills">
            {job.missingSkills.slice(0, 3).map((skill, i) => (
              <span key={i} className="skill-tag" style={{ borderColor: 'var(--warning)' }}>
                {skill.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {job.aiRecommendation && (
        <p className="mt-2 text-muted" style={{ fontSize: '0.85rem', fontStyle: 'italic' }}>
          💡 {job.aiRecommendation}
        </p>
      )}
    </div>
  )
}

// =============================================
// LEARNING TAB
// =============================================

function LearningTab({ learningPath }) {
  return (
    <div className="learning-tab">
      <div className="section-header mb-3">
        <h2>Your Learning Path</h2>
        <p className="text-muted">Skills to learn for your target jobs</p>
      </div>

      {learningPath.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-icon">📚</div>
          <h3>No learning path yet</h3>
          <p className="text-muted">Analyze your skills to generate a personalized learning roadmap.</p>
        </div>
      ) : (
        <div className="learning-timeline">
          {learningPath.map((step, i) => (
            <LearningStep key={i} step={step} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}

function LearningStep({ step, index }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={`learning-step ${step.status || 'pending'}`}>
      <div className="card" onClick={() => setExpanded(!expanded)} style={{ cursor: 'pointer' }}>
        <div className="flex justify-between items-center">
          <div>
            <span className="badge badge-primary mb-1">Step {index + 1}</span>
            <h3>{step.skill}</h3>
            <p className="text-muted">Target: {step.targetLevel} level</p>
          </div>
          <div className="text-muted">
            ⏱️ {step.estimatedHours}h
          </div>
        </div>

        {step.neededFor?.length > 0 && (
          <p className="text-muted mt-2" style={{ fontSize: '0.8rem' }}>
            Needed for: {step.neededFor.join(', ')}
          </p>
        )}

        {expanded && (
          <div className="mt-2">
            <h4 className="mb-1">📚 Resources:</h4>
            {(step.resources || step.suggestedResources || []).map((resource, i) => (
              <a
                key={i}
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="resource-link card mb-1"
                onClick={(e) => e.stopPropagation()}
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
      </div>
    </div>
  )
}

export default App
