import { useState, useEffect } from 'react'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
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
  const [jobDomain, setJobDomain] = useState('')
  const [jobRoles, setJobRoles] = useState([])
  const [learningPath, setLearningPath] = useState([])
  const [analyzing, setAnalyzing] = useState(false)
  const [showAssistant, setShowAssistant] = useState(false)
  const [resumeData, setResumeData] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [showResumePage, setShowResumePage] = useState(false)

  // Repository selection state
  const [showRepoSelector, setShowRepoSelector] = useState(false)
  const [repos, setRepos] = useState([])
  const [selectedRepos, setSelectedRepos] = useState([])
  const [fetchingRepos, setFetchingRepos] = useState(false)

  // Profile management state
  const [targetRole, setTargetRole] = useState('')
  const [matchPercentage, setMatchPercentage] = useState(0)
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)

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
        // Fetch profile data
        const profileRes = await fetch(`${API_URL}/auth/profile`, { credentials: 'include' })
        const profileData = await profileRes.json()
        if (profileData.success) {
          setInterests(profileData.profile.interests || '')
          setTargetRole(profileData.profile.targetRole || '')
        }
        loadDashboardData()
      }
    } catch (err) {
      console.log('Not authenticated')
    }
    setLoading(false)
  }

  const loadDashboardData = async () => {
    try {
      // Fetch skills and learning path in parallel
      const [skillsRes, learningRes] = await Promise.all([
        fetch(`${API_URL}/skills`, { credentials: 'include' }),
        fetch(`${API_URL}/learning/path`, { credentials: 'include' })
      ])

      const skillsData = await skillsRes.json()
      const learningData = await learningRes.json()

      let currentSkills = skills
      if (skillsData.skills && skillsData.skills.length > 0) {
        setSkills(skillsData.skills)
        currentSkills = skillsData.skills
      }

      if (learningData.learningPath) {
        setLearningPath(learningData.learningPath)
        if (learningData.summary?.matchPercentage) {
          setMatchPercentage(learningData.summary.matchPercentage)
        }
      }

      // Fetch AI job matches (POST with skills + interest)
      if (currentSkills.length > 0) {
        try {
          const skillNames = currentSkills.map(s => s.name || s.skills?.name || 'Unknown')
          const jobsRes = await fetch(`${API_URL}/jobs/generate-matches`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ skills: skillNames, interest: targetRole }),
            credentials: 'include'
          })
          const jobsData = await jobsRes.json()
          if (jobsData.domain) setJobDomain(jobsData.domain)
          if (jobsData.roles) setJobRoles(jobsData.roles)
        } catch (jobErr) {
          console.error('Error fetching job matches:', jobErr)
        }
      }
    } catch (err) {
      console.error('Error loading dashboard:', err)
    }
  }

  const analyzeSkills = async () => {
    setFetchingRepos(true)
    try {
      await fetch(`${API_URL}/skills/sync`, { method: 'POST', credentials: 'include' })
      const res = await fetch(`${API_URL}/repos`, { credentials: 'include' })
      const data = await res.json()
      if (data.repositories && data.repositories.length > 0) {
        const allRepoNames = data.repositories.map(r => r.name)
        setRepos(data.repositories)
        setSelectedRepos(allRepoNames)
        // Automatically analyze all repositories (no selector screen)
        await analyzeSelectedRepos(allRepoNames)
      }
    } catch (err) {
      console.error('Error fetching repos:', err)
    }
    setFetchingRepos(false)
  }

  const analyzeSelectedRepos = async (repoNames = selectedRepos) => {
    setShowRepoSelector(false)
    setAnalyzing(true)
    try {
      const limit = Array.isArray(repoNames) ? repoNames.length : 0
      const res = await fetch(`${API_URL}/skills/analyze${limit ? `?limit=${limit}` : ''}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repositories: repoNames }),
        credentials: 'include'
      })
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

  const handleSelectTarget = async (roleTitle) => {
    try {
      setTargetRole(roleTitle)
      setLearningPath([]) // Clear to show loading state

      // 1. Update backend profile
      await fetch(`${API_URL}/auth/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetRole: roleTitle }),
        credentials: 'include'
      })

      // 2. Fetch NEW learning path for this specific role (no cache!)
      const encodedRole = encodeURIComponent(roleTitle)
      const res = await fetch(`${API_URL}/learning/path?role=${encodedRole}`, {
        credentials: 'include'
      })
      const data = await res.json()
      if (data.success) {
        setLearningPath(data.learningPath)
        setMatchPercentage(data.summary?.matchPercentage || 0)
      } else {
        setLearningPath([{ title: 'Error', items: ['Failed to load learning path. Please try again.'] }])
      }

      // 3. Switch to mentor tab
      setActiveTab('learning')
    } catch (err) {
      console.error('Select target error:', err)
    }
  }

  const login = () => {
    window.location.href = `${API_URL}/auth/github`
  }

  const logout = async () => {
    await fetch(`${API_URL}/auth/logout`, { credentials: 'include' })
    setUser(null)
    setSkills([])
    setJobDomain('')
    setJobRoles([])
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

  // Repository selection view
  if (showRepoSelector) {
    return (
      <div className="app-container">
        <Header user={user} onLogout={logout} />
        <RepoSelector
          repos={repos}
          selectedRepos={selectedRepos}
          setSelectedRepos={setSelectedRepos}
          onAnalyze={analyzeSelectedRepos}
          onCancel={() => setShowRepoSelector(false)}
        />
      </div>
    )
  }

  // Full-page resume view
  if (showResumePage && resumeData) {
    return (
      <ResumeFullPage
        resume={resumeData}
        user={user}
        onBack={() => setShowResumePage(false)}
      />
    )
  }

  return (
    <div className="app-container">
      <Header user={user} onLogout={logout} />
      <NavTabs activeTab={activeTab} setActiveTab={setActiveTab} isAnalyzed={skills.length > 0} />

      <div className="tab-content">
        {activeTab === 'skills' && (
          <div style={{ marginBottom: '2rem' }}>
            <SkillsTab
              skills={skills}
              onAnalyze={analyzeSkills}
              analyzing={analyzing || fetchingRepos}
            />
          </div>
        )}

        {activeTab === 'jobs' && (
          <JobsTab
            domain={jobDomain}
            roles={jobRoles}
            onSelectTarget={handleSelectTarget}
            activeTargetRole={targetRole}
          />
        )}

        {activeTab === 'learning' && (
          <LearningTab
            learningPath={learningPath}
            matchPercentage={matchPercentage}
            targetRole={targetRole}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === 'resume' && (
          <ResumeTab
            skills={skills}
            user={user}
            setResumeData={setResumeData}
            generating={generating}
            setGenerating={setGenerating}
            setShowResumePage={setShowResumePage}
          />
        )}
      </div>

      <AIAssistant
        show={showAssistant}
        onToggle={() => setShowAssistant(!showAssistant)}
        skills={skills}
        jobs={jobRoles}
        interests={targetRole}
      />
    </div>
  )
}

// =============================================
// LOGIN PAGE - FIXED OTP FLOW
// =============================================

function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [otp, setOtp] = useState('')
  const [mode, setMode] = useState('login')
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isResetFlow, setIsResetFlow] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [otpToken, setOtpToken] = useState('')
  const [otpTimestamp, setOtpTimestamp] = useState(0)
  const [isCodeVerified, setIsCodeVerified] = useState(false)
  const [otpRequireGithubLinked, setOtpRequireGithubLinked] = useState(false)
  const [isGithubOtpFlow, setIsGithubOtpFlow] = useState(false)

  // Clear messages on mode change
  useEffect(() => {
    setError('')
    setSuccessMessage('')
  }, [mode])

  // If redirected back from GitHub OAuth, open OTP verification screen
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('githubOtp') !== '1') return

    ;(async () => {
      try {
        const pendingRes = await fetch(`${API_URL}/auth/github/otp/pending`, { credentials: 'include' })
        const pending = await pendingRes.json()
        if (pending?.pending) {
          setEmail(pending.email || '')
          setOtpToken(pending.token || '')
          setOtpTimestamp(pending.timestamp || 0)
          setMode('otp')
          setIsResetFlow(false)
          setIsCodeVerified(false)
          setOtpRequireGithubLinked(false)
          setIsGithubOtpFlow(true)
          setSuccessMessage('Enter the code sent to your GitHub email to finish login.')
        } else {
          setError('No pending GitHub verification. Please try again.')
        }
      } catch {
        setError('Failed to start GitHub verification. Please try again.')
      } finally {
        window.history.replaceState({}, '', window.location.pathname)
      }
    })()
  }, [])

  const goToLogin = () => {
    setMode('login')
    setIsResetFlow(false)
    setIsCodeVerified(false)
    setOtp('')
    setOtpToken('')
    setOtpTimestamp(0)
    setNewPassword('')
    setConfirmPassword('')
    setError('')
    setSuccessMessage('')
    setIsGithubOtpFlow(false)
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccessMessage('')
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include'
      })
      const data = await res.json()
      if (res.ok) {
        window.location.reload()
      } else if (data.needsVerification) {
        const otpRes = await fetch(`${API_URL}/auth/otp/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, requireGithubLinked: true }),
          credentials: 'include'
        })
        const otpData = await otpRes.json()
        if (otpData.token) {
          setOtpToken(otpData.token)
          setOtpTimestamp(otpData.timestamp)
        }
        setMode('otp')
        setOtpRequireGithubLinked(true)
        if (otpData.emailSent === false) {
          setError('Email delivery failed. Check server console for the code.')
        } else {
          setError('')
          setSuccessMessage('Verification code sent to your email.')
        }
      } else {
        setError(data.error || 'Invalid credentials')
      }
    } catch (err) {
      setError('Connection error')
    }
    setLoading(false)
  }

  const handleSignup = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccessMessage('')
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, username }),
        credentials: 'include'
      })
      const data = await res.json()
      if (res.ok) {
        const otpRes = await fetch(`${API_URL}/auth/otp/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, requireGithubLinked: false }),
          credentials: 'include'
        })
        const otpData = await otpRes.json()
        if (otpData.token) {
          setOtpToken(otpData.token)
          setOtpTimestamp(otpData.timestamp)
        }
        setMode('otp')
        setOtpRequireGithubLinked(false)
        if (otpData.emailSent === false) {
          setError('Email delivery failed. Check server console for the code.')
        } else {
          setSuccessMessage('Verification code sent to your email.')
        }
      } else {
        setError(data.error || 'Registration failed')
      }
    } catch (err) {
      setError('Connection error')
    }
    setLoading(false)
  }

  const handleVerifyOTP = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccessMessage('')
    try {
      if (isGithubOtpFlow) {
        const res = await fetch(`${API_URL}/auth/github/otp/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: otp }),
          credentials: 'include'
        })
        const data = await res.json()
        if (res.ok && data.success) {
          window.location.reload()
        } else {
          setError(data.error || data.message || 'Invalid verification code')
        }
        setLoading(false)
        return
      }

      if (isResetFlow && isCodeVerified) {
        // RESET FLOW STEP 2: Submit new password
        if (newPassword !== confirmPassword) {
          setError('Passwords do not match.')
          setLoading(false)
          return
        }
        if (newPassword.length < 6) {
          setError('Password must be at least 6 characters.')
          setLoading(false)
          return
        }
        if (!otp || otp.length !== 6) {
          setError('Please enter the 6-digit code.')
          setLoading(false)
          return
        }
        // Step 2: Submit new password with verified code
        const res = await fetch(`${API_URL}/auth/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, code: otp, newPassword, token: otpToken, timestamp: otpTimestamp }),
          credentials: 'include'
        })
        const data = await res.json()
        if (res.ok) {
        goToLogin()
          setSuccessMessage('Password reset successful! You can now log in.')
        } else {
          setError(data.error || data.message || 'Reset failed')
        }
      } else if (isResetFlow) {
        // RESET FLOW STEP 1: Just show password fields (don't verify yet)
        if (!otp || otp.length !== 6) {
          setError('Please enter the 6-digit code from your email.')
        } else {
          setIsCodeVerified(true)
          setSuccessMessage('Code entered. Now set your new password.')
        }
      } else {
        // SIGNUP/LOGIN VERIFICATION
        try {
          const res = await fetch(`${API_URL}/auth/otp/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code: otp, token: otpToken, timestamp: otpTimestamp }),
            credentials: 'include'
          })
          
          if (res.ok) {
            window.location.reload()
          } else {
            const data = await res.json()
            setError(data.error || data.message || 'Invalid verification code')
          }
        } catch (err) {
          setError('Connection error. Please try again.')
        }
      }
    } catch (err) {
      setError('An error occurred. Please try again.')
      console.error('Verify OTP error:', err)
    }
    setLoading(false)
  }

  const handleResetRequest = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccessMessage('')
    try {
      const res = await fetch(`${API_URL}/auth/otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, requireGithubLinked: false }),
        credentials: 'include'
      })
      const data = await res.json()
      if (res.ok) {
        setOtpToken(data.token || '')
        setOtpTimestamp(data.timestamp || 0)
        setMode('otp')
        setIsResetFlow(true)
        setIsCodeVerified(false)
        if (data.emailSent === false) {
          setError('Email delivery failed. Check server console for the code.')
        } else {
          setSuccessMessage('Verification code sent to your email. Check spam folder too.')
        }
      } else {
        setError('Failed to send reset code.')
      }
    } catch (err) {
      setError('Connection error')
    }
    setLoading(false)
  }

  const resendCode = async () => {
    setLoading(true)
    setError('')
    setSuccessMessage('')
    try {
      const res = await fetch(`${API_URL}/auth/otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, requireGithubLinked: otpRequireGithubLinked }),
        credentials: 'include'
      })
      const data = await res.json()
      if (res.ok) {
        setOtpToken(data.token || '')
        setOtpTimestamp(data.timestamp || 0)
        if (data.emailSent === false) {
          setError('Email delivery failed. Check server logs for the code.')
        } else {
          setSuccessMessage('New code sent to your email.')
        }
      } else {
        setError('Failed to resend code.')
      }
    } catch {
      setError('Connection error')
    }
    setLoading(false)
  }

  const backToLogin = () => {
    goToLogin()
  }

  const startGitHubAuth = () => {
    setLoading(true)
    window.location.href = `${API_URL}/auth/github`
  }

  return (
    <div className="login-body">
      <div className="login-card-modern">
        <div className="login-header-branded">
          <div className="login-logo-orb">
            <span className="material-symbols-outlined" style={{ fontSize: '32px', color: 'white' }}>terminal</span>
          </div>
          <h1 className="login-brand-title">Skill-to-Work</h1>
          <p className="login-brand-subtitle">AI-powered career intelligence</p>
        </div>

        <div className="login-content">
          <p className="login-instruction">
            {mode === 'login' && 'Please fill in all fields to proceed.'}
            {mode === 'signup' && 'Create your account to start your journey.'}
            {mode === 'otp' && !isCodeVerified && 'Enter the 6-digit code sent to your email.'}
            {mode === 'otp' && isCodeVerified && 'Create your new password.'}
            {mode === 'reset' && 'Verify your identity to reset your password.'}
          </p>

          {error && <div className="login-toast error">{error}</div>}
          {successMessage && <div className="login-toast success">{successMessage}</div>}

          {(mode === 'login' || mode === 'signup') && (
            <form onSubmit={mode === 'login' ? handleLogin : handleSignup}>
              {mode === 'signup' && (
                <div className="form-group-modern">
                  <label className="form-label-modern">USERNAME</label>
                  <div className="input-field-modern">
                    <span className="material-symbols-outlined input-icon-modern">person</span>
                    <input
                      type="text"
                      placeholder="alex_dev"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}

              <div className="form-group-modern">
                <label className="form-label-modern">EMAIL ADDRESS</label>
                <div className="input-field-modern">
                  <span className="material-symbols-outlined input-icon-modern">mail</span>
                  <input
                    type="email"
                    placeholder="name@university.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group-modern">
                <div className="flex justify-between items-center">
                  <label className="form-label-modern">PASSWORD</label>
                  {mode === 'login' && (
                    <button type="button" className="forgot-link" onClick={() => setMode('reset')}>Forgot?</button>
                  )}
                </div>
                <div className="input-field-modern">
                  <span className="material-symbols-outlined input-icon-modern">lock</span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    <span className="material-symbols-outlined">{showPassword ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              </div>

              <button className="btn-signin-modern" type="submit" disabled={loading}>
                {loading ? 'Processing...' : (mode === 'login' ? 'Sign In' : 'Create Account')}
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
            </form>
          )}

          {mode === 'reset' && (
            <form onSubmit={handleResetRequest}>
              <div className="form-group-modern">
                <label className="form-label-modern">EMAIL ADDRESS</label>
                <div className="input-field-modern">
                  <span className="material-symbols-outlined input-icon-modern">mail</span>
                  <input
                    type="email"
                    placeholder="name@university.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              <button className="btn-signin-modern" type="submit" disabled={loading}>
                {loading ? 'Sending...' : 'Send Reset Code'}
                <span className="material-symbols-outlined">send</span>
              </button>
              <button type="button" className="back-to-login" onClick={goToLogin}>Back to Sign In</button>
            </form>
          )}

          {mode === 'otp' && (
            <form onSubmit={handleVerifyOTP}>
              {/* Show code field only if code not yet verified (or not in reset flow) */}
              {!(isResetFlow && isCodeVerified) && (
                <div className="form-group-modern">
                  <label className="form-label-modern">VERIFICATION CODE</label>
                  <div className="input-field-modern">
                    <span className="material-symbols-outlined input-icon-modern">shield</span>
                    <input
                      type="text"
                      maxLength="6"
                      placeholder="000000"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      style={{ letterSpacing: '0.5rem', textAlign: 'center' }}
                      required
                    />
                  </div>
                </div>
              )}

              {/* Show new password + confirm password fields ONLY after code is verified in reset flow */}
              {isResetFlow && isCodeVerified && (
                <>
                  <div className="form-group-modern">
                    <label className="form-label-modern">NEW PASSWORD</label>
                    <div className="input-field-modern">
                      <span className="material-symbols-outlined input-icon-modern">lock</span>
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        tabIndex={-1}
                      >
                        <span className="material-symbols-outlined">{showNewPassword ? 'visibility_off' : 'visibility'}</span>
                      </button>
                    </div>
                  </div>
                  <div className="form-group-modern">
                    <label className="form-label-modern">CONFIRM PASSWORD</label>
                    <div className="input-field-modern">
                      <span className="material-symbols-outlined input-icon-modern">lock_reset</span>
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        tabIndex={-1}
                      >
                        <span className="material-symbols-outlined">{showConfirmPassword ? 'visibility_off' : 'visibility'}</span>
                      </button>
                    </div>
                    {confirmPassword && newPassword !== confirmPassword && (
                      <p style={{ color: '#e53e3e', fontSize: '0.8rem', marginTop: '0.3rem' }}>Passwords do not match</p>
                    )}
                  </div>
                </>
              )}

              <button className="btn-signin-modern" type="submit" disabled={loading}>
                {loading ? 'Processing...' : (
                  isResetFlow && isCodeVerified ? 'Reset Password' :
                    isResetFlow ? 'Verify Code' :
                      'Verify & Proceed'
                )}
                <span className="material-symbols-outlined">
                  {isResetFlow && isCodeVerified ? 'lock_reset' : 'verified_user'}
                </span>
              </button>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                <button type="button" className="back-to-login" onClick={goToLogin}>Back to Login</button>
                {!(isResetFlow && isCodeVerified) && (
                  <button
                    type="button"
                    className="back-to-login"
                    disabled={loading}
                    onClick={async () => {
                      setLoading(true)
                      setError('')
                      try {
                        const res = await fetch(`${API_URL}/auth/otp/send`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ email, requireGithubLinked: otpRequireGithubLinked }),
                          credentials: 'include'
                        })
                        const data = await res.json()
                        if (res.ok) {
                          setOtpToken(data.token || '')
                          setOtpTimestamp(data.timestamp || 0)
                          if (data.emailSent === false) {
                            setError('Email delivery failed. Check server logs for the code.')
                          } else {
                            setSuccessMessage('New code sent to your email.')
                          }
                        } else {
                          setError('Failed to resend code.')
                        }
                      } catch {
                        setError('Connection error')
                      }
                      setLoading(false)
                    }}
                  >
                    Resend Code
                  </button>
                )}
              </div>
            </form>
          )}

          {mode === 'login' && (
            <>
              <div className="divider-modern">
                <span className="divider-text">OR CONTINUE WITH</span>
              </div>

              <button className="btn-github-auth" onClick={startGitHubAuth}>
                <svg viewBox="0 0 24 24" className="github-icon-svg">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"></path>
                </svg>
                Connect with GitHub
              </button>
              <p className="github-hint">Secure authentication via GitHub for technical project mapping</p>
            </>
          )}

          <div className="login-footer-switch">
            {mode === 'login' ? (
              <p>Don't have an account? <button type="button" onClick={() => setMode('signup')} className="green-link">Create Account</button></p>
            ) : (
              <p>Already have an account? <button type="button" onClick={goToLogin} className="green-link">Sign In</button></p>
            )}
          </div>
        </div>

        <div className="security-footer-badge">
          <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#666' }}>verified_user</span>
          <span>Secure OAuth 2.0 Authentication</span>
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
        <div className="logo-icon">
          <span className="material-symbols-outlined" style={{ color: 'white', fontSize: '22px' }}>terminal</span>
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

function SkillsTab({
  skills,
  onAnalyze,
  analyzing
}) {
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
    { label: 'Project Completeness', status: skills.length >= 5 ? 'good' : 'neutral', icon: <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>verified</span> },
    { label: 'Tech Diversity', status: categories.length >= 3 ? 'good' : 'neutral', icon: <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>category</span> },
    { label: 'Modern Stack', status: skills.some(s => ['React', 'TypeScript', 'Docker'].includes(s.name)) ? 'good' : 'improve', icon: <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>rocket_launch</span> },
  ] : []

  return (
    <div className="skills-tab">
      <div className="section-header flex justify-between items-center mb-3">
        <div>
          <h2>Your Skills</h2>
          <p className="text-muted">{skills.length} skills detected from your repositories</p>
          {skills.length > 0 && (
            <span className="how-calculated">
              How was this calculated?
            </span>
          )}
        </div>
        <div className="flex gap-1 items-center">
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
              <>Analyze Repos</>
            )}
          </button>
        </div>
      </div>

      {
        skills.length === 0 ? (
          <div className="empty-state card">
            <div className="empty-icon">...</div>
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
        )
      }
    </div >
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
    language: <span className="material-symbols-outlined" style={{ fontSize: '20px', verticalAlign: 'middle', marginRight: '4px' }}>code</span>,
    framework: <span className="material-symbols-outlined" style={{ fontSize: '20px', verticalAlign: 'middle', marginRight: '4px' }}>architecture</span>,
    database: <span className="material-symbols-outlined" style={{ fontSize: '20px', verticalAlign: 'middle', marginRight: '4px' }}>database</span>,
    tool: <span className="material-symbols-outlined" style={{ fontSize: '20px', verticalAlign: 'middle', marginRight: '4px' }}>build</span>,
    cloud: <span className="material-symbols-outlined" style={{ fontSize: '20px', verticalAlign: 'middle', marginRight: '4px' }}>cloud</span>,
    concept: <span className="material-symbols-outlined" style={{ fontSize: '20px', verticalAlign: 'middle', marginRight: '4px' }}>psychology</span>
  }
  return icons[category] || <span className="material-symbols-outlined" style={{ fontSize: '20px', verticalAlign: 'middle', marginRight: '4px' }}>extension</span>
}

// =============================================
// JOBS TAB - ENHANCED
// =============================================

function JobsTab({ domain, roles = [], onSelectTarget, activeTargetRole }) {
  const [dreamJob, setDreamJob] = useState('')
  const [selectedRoleForSim, setSelectedRoleForSim] = useState(null)
  const [showDreamInput, setShowDreamInput] = useState(false)

  return (
    <div className="jobs-tab">
      <div className="section-header mb-3 flex justify-between items-end">
        <div>
          <h2>Recommended Roles</h2>
          <p className="text-muted">AI-powered matches based on your skills and interests</p>
        </div>
        {!showDreamInput && (
          <button
            className="btn btn-ghost"
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
            onClick={() => setShowDreamInput(true)}
          >
            Set Career Goal
          </button>
        )}
      </div>

      {showDreamInput && (
        <div className="card glass-panel mb-4" style={{ position: 'relative', animation: 'fadeIn 0.3s ease' }}>
          <button
            onClick={() => setShowDreamInput(false)}
            style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
          <h3 className="mb-2">Career Goal</h3>
          <p className="text-muted mb-2">Enter your desired career role (e.g., AI Engineer, Frontend Developer, Cybersecurity Analyst)</p>
          <div className="flex gap-1">
            <input
              type="text"
              value={dreamJob}
              onChange={(e) => setDreamJob(e.target.value)}
              placeholder="e.g., Quantum Computing Researcher, ML Architect..."
              className="form-input"
              style={{ flex: 1, padding: '0.75rem' }}
            />
            <button
              className="btn btn-primary"
              onClick={() => dreamJob && onSelectTarget(dreamJob)}
              disabled={!dreamJob}
            >
              Set as Goal
            </button>
          </div>
        </div>
      )}

      {domain && (
        <div className="card glass-panel mb-4" style={{ animation: 'fadeIn 0.3s ease' }}>
          <div className="flex items-center gap-1 mb-2">
            <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--teal)' }}>target</span>
            <h3 style={{ margin: 0 }}>Your Domain</h3>
          </div>
          <span style={{
            display: 'inline-block',
            padding: '0.4rem 1rem',
            borderRadius: '2rem',
            background: 'var(--teal)',
            color: 'white',
            fontSize: '0.9rem',
            fontWeight: 600
          }}>
            {domain}
          </span>
        </div>
      )}

      {roles.length > 0 && (
        <div className="card glass-panel mb-4" style={{ animation: 'fadeIn 0.3s ease' }}>
          <div className="flex items-center gap-1 mb-2">
            <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--teal)' }}>auto_awesome</span>
            <h3 style={{ margin: 0 }}>Roles For You</h3>
            <span className="text-muted" style={{ fontSize: '0.75rem', marginLeft: '0.5rem' }}>AI-suggested based on your skills</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {roles.map((role, i) => (
              <button
                key={i}
                className={`btn ${activeTargetRole === role ? 'btn-primary' : 'btn-ghost'}`}
                style={{
                  fontSize: '0.85rem',
                  padding: '0.5rem 1rem',
                  borderRadius: '2rem',
                  border: activeTargetRole === role ? 'none' : '1px solid var(--border)',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => onSelectTarget(role)}
              >
                {role}
              </button>
            ))}
          </div>
        </div>
      )}

      {roles.length === 0 && !domain && (
        <div className="empty-state card">
          <div className="empty-icon">...</div>
          <h3>No matches yet</h3>
          <p className="text-muted">Analyze your skills first to get AI-powered job role suggestions!</p>
        </div>
      )}

      {selectedRoleForSim && (
        <RoleSimulationModal
          role={selectedRoleForSim}
          onClose={() => setSelectedRoleForSim(null)}
        />
      )}
    </div>
  )
}

function EnhancedJobCard({ job, rank, onPreview, onSelectTarget, isActiveTarget }) {
  const getScoreClass = (score) => {
    if (score >= 80) return 'excellent'
    if (score >= 60) return 'good'
    if (score >= 40) return 'moderate'
    return 'low'
  }

  return (
    <div className={`card job-card-enhanced ${getScoreClass(job.score)} ${isActiveTarget ? 'active-target' : ''}`}>
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="job-title-pill">{job.title}</h3>
          <p className="text-muted" style={{ fontSize: '0.8rem' }}>Match Score: {job.score}%</p>
        </div>
        <div className={`match-orb ${getScoreClass(job.score)}`}>
          {job.score}%
        </div>
      </div>

      <div className="mb-3">
        <h4 className="section-label">Matched Skills:</h4>
        <div className="flex flex-wrap gap-1 mt-1">
          {job.matchingSkills?.slice(0, 5).map((skill, i) => (
            <span key={i} className="skill-tag matched">{skill}</span>
          ))}
        </div>
      </div>

      <div className="mb-3">
        <h4 className="section-label">Missing Skills:</h4>
        <div className="flex flex-wrap gap-1 mt-1">
          {job.missingSkills?.slice(0, 3).map((skill, i) => (
            <span key={i} className="skill-tag missing">
              {typeof skill === 'string' ? skill : skill.name}
            </span>
          ))}
        </div>
      </div>

      <div className="job-card-actions mb-1">
        <button className="btn btn-outline" onClick={onPreview}>
          Preview Role
        </button>
        <button
          className={`btn ${isActiveTarget ? 'btn-success' : 'btn-primary'}`}
          onClick={onSelectTarget}
          disabled={isActiveTarget}
        >
          {isActiveTarget ? '✓ Selected' : 'Set as Target'}
        </button>
      </div>
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
            <h4>Daily Tasks</h4>
            <ul className="role-list">
              {roleData.dailyTasks.map((task, i) => (
                <li key={i}>{task}</li>
              ))}
            </ul>
          </div>

          <div className="role-section">
            <h4>Common Tools</h4>
            <div className="flex flex-wrap gap-1">
              {roleData.tools.map((tool, i) => (
                <span key={i} className="tool-tag">{tool}</span>
              ))}
            </div>
          </div>

          <div className="role-section">
            <h4>Key Responsibilities</h4>
            <ul className="role-list">
              {roleData.responsibilities.map((resp, i) => (
                <li key={i}>{resp}</li>
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
    },
    'UI/UX Designer': {
      dailyTasks: ['Create wireframes and prototypes', 'Conduct user research', 'Design high-fidelity mockups', 'Handoff to developers', 'Run usability tests'],
      tools: ['Figma', 'Adobe XD', 'Sketch', 'Miro', 'Lottie', 'Notion'],
      responsibilities: ['User-centered design', 'Visual consistency', 'Accessibility compliance', 'Stakeholder alignment']
    },
    'Data Analyst': {
      dailyTasks: ['Clean data sets', 'Run SQL queries', 'Create dashboards', 'Present insights to teams', 'Monitor data quality'],
      tools: ['Tableau', 'Power BI', 'Python (Pandas)', 'SQL', 'Excel', 'Google Analytics'],
      responsibilities: ['Translate data to strategy', 'Data storytelling', 'Predictive modeling', 'Business performance tracking']
    },
    'Product Manager': {
      dailyTasks: ['Define product requirements', 'Manage product backlog', 'Prioritize features', 'Market analysis', 'Cross-team coordination'],
      tools: ['Jira', 'Confluence', 'Aha!', 'Slack', 'SQL', 'Mixpanel'],
      responsibilities: ['Product vision', 'Roadmap execution', 'Market positioning', 'User growth strategies']
    },
    'Technical Writer': {
      dailyTasks: ['Write API documentation', 'Create user guides', 'Review developer docs', 'Edit release notes', 'Interview subject matter experts'],
      tools: ['Markdown', 'Git', 'Docusaurus', 'Postman', 'Notion', 'Vs Code'],
      responsibilities: ['Clarity and accuracy', 'Documentation structure', 'Version control for docs', 'Developer experience focus']
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

function LearningTab({ learningPath, matchPercentage, targetRole, setActiveTab }) {
  return (
    <div className="learning-tab">
      <div className="section-header mb-4">
        <div className="flex justify-between items-end">
          <div>
            <h2>AI Career Mentor</h2>
            <p className="text-muted">Personalized roadmap to {targetRole || 'your goal'} using HuggingFace AI</p>
          </div>
          {targetRole && (
            <div className="match-progress-container">
              <div className="flex justify-between mb-1">
                <span className="text-muted" style={{ fontSize: '0.75rem' }}>Goal Readiness</span>
                <span style={{ fontWeight: 700, color: 'var(--teal)' }}>{matchPercentage}%</span>
              </div>
              <div className="progress-bar-bg" style={{ width: '150px', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }}>
                <div
                  className="progress-bar-fill"
                  style={{
                    width: `${matchPercentage}%`,
                    height: '100%',
                    background: 'var(--teal)',
                    borderRadius: '4px',
                    boxShadow: '0 0 10px var(--teal)'
                  }}
                ></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {!targetRole ? (
        <div className="empty-state card">
          <div className="empty-icon">...</div>
          <h3>Select a target role first</h3>
          <p className="text-muted">Go to the "Jobs" tab and select a role as your target to generate an AI learning path.</p>
        </div>
      ) : learningPath.length === 0 ? (
        <div className="empty-state">
          <div className="spinner mb-2"></div>
          <p className="text-muted">Building your personalized roadmap...</p>
        </div>
      ) : learningPath[0]?.title === 'Error' ? (
        <div className="empty-state card">
          <div className="empty-icon">X</div>
          <h3>Failed to load roadmap</h3>
          <p className="text-muted">{learningPath[0].items[0]}</p>
          <button className="btn btn-primary mt-2" onClick={() => setActiveTab('jobs')}>
            Back to Jobs
          </button>
        </div>
      ) : (
        <div className="learning-sections">
          {learningPath.map((section, i) => (
            <div key={i} className="card mb-3 glass-panel">
              <h3 className="mb-2 flex items-center gap-1">
                <span className="material-symbols-outlined" style={{ color: 'var(--purple-light)', fontSize: '20px' }}>
                  {section.title.toLowerCase().includes('roadmap') || section.title.toLowerCase().includes('step') ? 'route'
                    : section.title.toLowerCase().includes('missing') ? 'error_outline'
                      : section.title.toLowerCase().includes('technolog') ? 'memory'
                        : section.title.toLowerCase().includes('project') ? 'code_blocks'
                          : 'school'}
                </span>
                {section.title}
              </h3>
              <ul className="learning-list-modern">
                {section.items.map((item, j) => (
                  <li key={j} className="mb-1">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
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
              {step.projectBased && <span className="project-badge">Project-Based</span>}
            </div>
            <h3>{step.skill}</h3>
            <p className="text-muted">Target: {step.targetLevel} level</p>
          </div>
          <div className="time-badge">
            {step.estimatedHours}h
          </div>
        </div>

        {step.neededFor?.length > 0 && (
          <p className="text-muted mt-2" style={{ fontSize: '0.8rem' }}>
            Needed for: {step.neededFor.join(', ')}
          </p>
        )}

        {expanded && (
          <div className="mt-2" style={{ animation: 'fadeIn 0.3s ease' }}>
            <h4 className="mb-1">Learning Resources:</h4>
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
        <h2>Resume Generator</h2>
        <p className="text-muted">Fill in your details • Skills auto-populated from GitHub • AI polishes your resume</p>
      </div>

      {/* Personal Info */}
      <div className="card resume-section mb-2">
        <h3 className="mb-2">Personal Information</h3>
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
          <h3>Education</h3>
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
          <h3>Internships</h3>
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
          <h3>Projects</h3>
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
          <h3>Co-curricular Activities</h3>
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
          <h3>Certifications</h3>
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
        <h3 className="mb-2">Technical Skills {skills.length > 0 && <span className="badge badge-success">Auto-detected from GitHub</span>}</h3>
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
          <>Generate Resume</>
        )}
      </button>
    </div>
  )
}

// =============================================
// FULL-PAGE RESUME VIEW
// =============================================

function ResumeFullPage({ resume, user, onBack }) {
  const [downloading, setDownloading] = useState(false)

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const element = document.getElementById('resume-print')
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#FFFFFF'
      })

      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      const imgProps = pdf.getImageProperties(imgData)
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
      pdf.save(`${user?.name || 'Resume'}-SkillBridge.pdf`)
    } catch (err) {
      console.error('PDF generation error:', err)
      // Fallback to print if PDF generation fails
      window.print()
    }
    setDownloading(false)
  }

  return (
    <div className="resume-full-page">
      <div className="resume-full-page-toolbar no-print">
        <button className="btn btn-secondary" onClick={onBack}>
          Edit
        </button>
        <h3>Your Resume</h3>
        <p className="no-print" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Tip: Select "Save as PDF" in the print destination.</p>
        <div className="flex gap-1">
          <button
            className={`btn btn-primary ${downloading ? 'ai-shimmer' : ''}`}
            onClick={handleDownload}
            disabled={downloading}
          >
            {downloading ? (
              <>
                <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2, marginRight: '8px' }}></div>
                Downloading...
              </>
            ) : (
              <>Download PDF</>
            )}
          </button>
          <button className="btn btn-secondary no-print" onClick={() => window.print()}>
            Print
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
        {show ? '✕' : 'AI'}
      </button>

      {show && (
        <div className="ai-assistant-panel">
          <div className="ai-panel-header">
            <span>AI</span>
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

// =============================================
// REPOSITORY SELECTOR
// =============================================

function RepoSelector({ repos, selectedRepos, setSelectedRepos, onAnalyze, onCancel }) {
  const toggleRepo = (name) => {
    if (selectedRepos.includes(name)) {
      setSelectedRepos(selectedRepos.filter(r => r !== name))
    } else {
      setSelectedRepos([...selectedRepos, name])
    }
  }

  const selectAll = () => setSelectedRepos(repos.map(r => r.name))
  const deselectAll = () => setSelectedRepos([])

  return (
    <div className="repo-selector">
      <div className="repo-selector-header">
        <div>
          <h2>Select Repositories</h2>
          <p className="text-muted">Choose which repositories to analyze for skill detection</p>
        </div>
        <div className="repo-selector-actions">
          <button className="btn btn-ghost" onClick={selectAll}>Select All</button>
          <button className="btn btn-ghost" onClick={deselectAll}>Deselect All</button>
        </div>
      </div>

      <div className="repo-selector-count">
        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>folder</span>
        {selectedRepos.length} of {repos.length} repositories selected
      </div>

      <div className="repo-grid">
        {repos.map(repo => (
          <div
            key={repo.name}
            className={`repo-card ${selectedRepos.includes(repo.name) ? 'selected' : ''}`}
            onClick={() => toggleRepo(repo.name)}
          >
            <div className="repo-card-check">
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                {selectedRepos.includes(repo.name) ? 'check_circle' : 'radio_button_unchecked'}
              </span>
            </div>
            <div className="repo-card-info">
              <strong>{repo.name}</strong>
              {repo.description && <p className="repo-desc">{repo.description}</p>}
              <div className="repo-meta">
                {repo.language && (
                  <span className="repo-lang">
                    <span className="lang-dot" style={{ background: getLanguageColor(repo.language) }}></span>
                    {repo.language}
                  </span>
                )}
                {repo.private && <span className="repo-badge">Private</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="repo-selector-footer">
        <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button
          className="btn btn-primary"
          onClick={onAnalyze}
          disabled={selectedRepos.length === 0}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>analytics</span>
          Analyze {selectedRepos.length} Repositor{selectedRepos.length === 1 ? 'y' : 'ies'}
        </button>
      </div>
    </div>
  )
}

function getLanguageColor(lang) {
  const colors = {
    JavaScript: '#f1e05a',
    TypeScript: '#3178c6',
    Python: '#3572A5',
    Java: '#b07219',
    'C++': '#f34b7d',
    HTML: '#e34c26',
    CSS: '#563d7c',
    Ruby: '#701516',
    Go: '#00ADD8',
    Rust: '#dea584',
    PHP: '#4F5D95',
    Swift: '#F05138',
    Kotlin: '#A97BFF',
    Dart: '#00B4AB'
  }
  return colors[lang] || '#8b949e'
}

export default App
