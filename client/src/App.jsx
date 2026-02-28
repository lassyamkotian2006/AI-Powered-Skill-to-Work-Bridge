// ===============================
// FIXED loadDashboardData
// ===============================
const loadDashboardData = async (newSkills = null) => {
  try {
    const [skillsRes, learningRes] = await Promise.all([
      fetch(`${API_URL}/skills`, { credentials: 'include' }),
      fetch(`${API_URL}/learning/path`, { credentials: 'include' })
    ])

    const skillsData = await skillsRes.json()
    const learningData = await learningRes.json()

    // Always use fresh skills if provided
    const currentSkills = newSkills || skillsData.skills || []

    if (skillsData.skills && skillsData.skills.length > 0) {
      setSkills(skillsData.skills)
    }

    if (learningData.learningPath) {
      setLearningPath(learningData.learningPath)
      if (learningData.summary?.matchPercentage) {
        setMatchPercentage(learningData.summary.matchPercentage)
      }
    }

    // 🔥 Always trigger AI job matching if skills exist
    if (currentSkills.length > 0) {
      const skillNames = currentSkills.map(s => s.name || 'Unknown')

      const jobsRes = await fetch(`${API_URL}/jobs/generate-matches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          skills: skillNames,
          interest: interests
        })
      })

      const jobsData = await jobsRes.json()

      setJobDomain(jobsData.domain || '')
      setJobRoles(jobsData.roles || [])
    } else {
      setJobDomain('')
      setJobRoles([])
    }

  } catch (err) {
    console.error('Error loading dashboard:', err)
  }
}

// ===============================
// FIXED analyzeSkills
// ===============================
const analyzeSkills = async () => {
  setAnalyzing(true)
  try {
    await fetch(`${API_URL}/skills/sync`, {
      method: 'POST',
      credentials: 'include'
    })

    const res = await fetch(`${API_URL}/skills/analyze`, {
      method: 'POST',
      credentials: 'include'
    })

    const data = await res.json()

    if (data.success) {
      const freshSkills = data.skills || []
      setSkills(freshSkills)

      // 🔥 Immediately generate job matches using fresh skills
      await loadDashboardData(freshSkills)
    }

  } catch (err) {
    console.error('Error analyzing skills:', err)
  }

  setAnalyzing(false)
}
