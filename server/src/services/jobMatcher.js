/**
 * Job Matching Service
 * --------------------
 * Compares user skills with job requirements to provide
 * personalized job recommendations and identify skill gaps.
 */

// =============================================
// SKILL RELATIONS & SEMANTIC MAPPING
// =============================================

/**
 * Maps skills to related skills to allow "semantic" matching.
 * Score is between 0 and 1, indicating how much the related skill
 * covers the knowledge of the main skill.
 */
const SKILL_RELATIONS = {
    // Languages to Concepts
    'python': { 'data analysis': 0.6, 'scripting': 0.8, 'automation': 0.7, 'backend development': 0.5 },
    'javascript': { 'web development': 0.8, 'frontend development': 0.7, 'backend development': 0.4 },
    'sql': { 'database management': 0.8, 'data analysis': 0.5 },

    // Tools to Concepts
    'docker': { 'ci/cd': 0.5, 'devops': 0.6, 'containerization': 1.0 },
    'figma': { 'ui design': 0.9, 'ux design': 0.7, 'prototyping': 0.8 },

    // Frameworks to Languages
    'react': { 'javascript': 0.8, 'frontend development': 0.9 },
    'node.js': { 'javascript': 0.8, 'backend development': 0.9 },

    // General technical knowledge mappings
    'git': { 'version control': 1.0, 'collaboration': 0.5 },
    'markdown': { 'technical writing': 0.4, 'documentation': 0.6 }
};

// =============================================
// JOB MATCHING ALGORITHM
// =============================================

/**
 * Calculate match score between user skills and a job role
 * @param {Array} userSkills - User's skills with proficiency levels
 * @param {Object} jobRole - Job role with required skills
 * @param {string} interests - User's declared interests
 * @returns {Object} Match result with score and skill breakdown
 */
function calculateJobMatch(userSkills, jobRole, interests = "") {
    // Create a map of user skills for quick lookup (case insensitive)
    const userSkillMap = new Map();
    for (const skill of userSkills) {
        const name = (skill.name || skill.skills?.name || '').toLowerCase();
        userSkillMap.set(name, {
            name: skill.name || skill.skills?.name,
            level: skill.level || skill.proficiency_level,
            category: skill.category || skill.skills?.category,
            repoCount: skill.repoCount || skill.repo_count || 0,
            evidence: skill.evidence || []
        });
    }

    // Get required and preferred skills from job role
    const jobSkills = jobRole.job_skills || [];
    const requiredSkills = jobSkills.filter(js => js.importance === 'required');
    const preferredSkills = jobSkills.filter(js => js.importance === 'preferred');
    const niceToHaveSkills = jobSkills.filter(js => js.importance === 'nice-to-have');

    // Track matching and missing skills
    const matchingSkills = [];
    const missingSkills = [];
    let requiredMatches = 0;
    let preferredMatches = 0;
    let niceToHaveMatches = 0;

    // Check required skills (most important)
    for (const jobSkill of requiredSkills) {
        const skillName = jobSkill.skills?.name || jobSkill.name;
        if (!skillName) continue;

        const skillKey = skillName.toLowerCase();
        let userHas = userSkillMap.get(skillKey);
        let matchScore = 0;
        let isSemanticMatch = false;

        if (userHas) {
            matchScore = 1;
        } else {
            // Check for semantic matches (related skills)
            for (const [userSkill, relations] of userSkillMap) {
                if (SKILL_RELATIONS[userSkill] && SKILL_RELATIONS[userSkill][skillKey]) {
                    const relationScore = SKILL_RELATIONS[userSkill][skillKey];
                    if (relationScore > matchScore) {
                        matchScore = relationScore;
                        isSemanticMatch = true;
                        // Use the user skill's level as a proxy
                        userHas = relations;
                    }
                }
            }
        }

        if (userHas && matchScore > 0) {
            matchingSkills.push({
                name: skillName,
                importance: 'required',
                userLevel: userHas.level,
                requiredLevel: jobSkill.min_proficiency,
                meetsLevel: meetsMinLevel(userHas.level, jobSkill.min_proficiency),
                semantic: isSemanticMatch,
                matchStrength: matchScore,
                repoCount: userHas.repoCount || 0,
                evidence: userHas.evidence || []
            });
            requiredMatches += matchScore;
        } else {
            missingSkills.push({
                name: skillName,
                importance: 'required',
                minLevel: jobSkill.min_proficiency || 'beginner',
                category: jobSkill.skills?.category || jobSkill.category || 'other'
            });
        }
    }

    // Check preferred skills
    for (const jobSkill of preferredSkills) {
        const skillName = jobSkill.skills?.name || jobSkill.name;
        if (!skillName) continue;

        const skillKey = skillName.toLowerCase();
        let userHas = userSkillMap.get(skillKey);
        let matchScore = 0;

        if (userHas) {
            matchScore = 1;
        } else {
            // Semantic match check
            for (const [userSkill, relations] of userSkillMap) {
                if (SKILL_RELATIONS[userSkill] && SKILL_RELATIONS[userSkill][skillKey]) {
                    const relationScore = SKILL_RELATIONS[userSkill][skillKey];
                    if (relationScore > matchScore) {
                        matchScore = relationScore;
                        userHas = relations;
                    }
                }
            }
        }

        if (userHas && matchScore > 0) {
            matchingSkills.push({
                name: skillName,
                importance: 'preferred',
                userLevel: userHas.level,
                requiredLevel: jobSkill.min_proficiency,
                meetsLevel: meetsMinLevel(userHas.level, jobSkill.min_proficiency),
                matchStrength: matchScore,
                repoCount: userHas.repoCount || 0,
                evidence: userHas.evidence || []
            });
            preferredMatches += matchScore;
        } else {
            missingSkills.push({
                name: skillName,
                importance: 'preferred',
                minLevel: jobSkill.min_proficiency || 'beginner',
                category: jobSkill.skills?.category || jobSkill.category || 'other'
            });
        }
    }

    // Check nice-to-have skills
    for (const jobSkill of niceToHaveSkills) {
        const skillName = jobSkill.skills?.name || jobSkill.name;
        if (!skillName) continue;

        const skillKey = skillName.toLowerCase();
        const userHas = userSkillMap.get(skillKey);

        if (userHas) {
            matchingSkills.push({
                name: skillName,
                importance: 'nice-to-have',
                userLevel: userHas.level
            });
            niceToHaveMatches++;
        }
    }

    // Calculate category density for the user
    const categoryCounts = new Map();
    for (const skill of userSkillMap.values()) {
        const cat = skill.category || 'other';
        categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
    }

    // Total weight for categories (used for normalization)
    const totalUserSkills = userSkills.length;

    // Calculate weighted score
    let totalWeight = 0;
    let earnedWeight = 0;

    if (requiredSkills.length > 0) {
        totalWeight += 60;
        earnedWeight += (requiredMatches / requiredSkills.length) * 60;
    }

    if (preferredSkills.length > 0) {
        totalWeight += 30;
        earnedWeight += (preferredMatches / preferredSkills.length) * 30;
    }

    if (niceToHaveSkills.length > 0) {
        totalWeight += 10;
        earnedWeight += (niceToHaveMatches / niceToHaveSkills.length) * 10;
    }

    // Normalized base score (if no skills defined at all, default to 0)
    let matchScore = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;

    // --- ENHANCEMENT: Interest Boost ---
    let interestBoost = 0;
    if (interests && typeof interests === 'string') {
        const interestKeywords = interests.toLowerCase().split(/[,\s]+/).filter(k => k.length > 2);
        const jobTitleLower = jobRole.title.toLowerCase();

        for (const keyword of interestKeywords) {
            if (jobTitleLower.includes(keyword)) {
                interestBoost += 15; // Significant boost if interest matches job title
                break; // One match is enough for full title boost
            }
        }
    }
    matchScore = Math.min(100, matchScore + interestBoost);

    // --- ENHANCEMENT: Category Density Boost ---
    // If the user has a high density of skills in the categories required for this job, give a small boost
    const jobCategories = new Set(jobSkills.map(js => js.skills?.category || js.category).filter(Boolean));
    let catBoost = 0;

    for (const cat of jobCategories) {
        const userCatCount = categoryCounts.get(cat) || 0;
        if (userCatCount > 2) { // User has multiple skills in this category
            catBoost += 4; // Increased from 2
        }
    }
    matchScore = Math.min(100, matchScore + catBoost);

    // --- ENHANCEMENT: Experience/Quality Boost ---
    // Use repo_count and evidence as proxies for "Code Quality Signals"
    let qualityBoost = 0;
    for (const match of matchingSkills) {
        // Boost score if the matched skill has high repo count (demonstrates experience)
        if (match.repoCount >= 5) qualityBoost += 1;
        else if (match.repoCount >= 3) qualityBoost += 0.5;
    }
    matchScore = Math.min(100, matchScore + qualityBoost);

    // Determine fit level
    let fitLevel = 'low';
    if (matchScore >= 80) fitLevel = 'excellent';
    else if (matchScore >= 60) fitLevel = 'good';
    else if (matchScore >= 40) fitLevel = 'moderate';

    return {
        jobId: jobRole.id,
        jobTitle: jobRole.title,
        jobSlug: jobRole.slug,
        score: Math.round(matchScore),
        fitLevel,
        matchingSkills,
        missingSkills: missingSkills.filter(s => s.importance !== 'nice-to-have'), // Only show important gaps
        roadmap: {
            steps: missingSkills
                .filter(s => s.importance !== 'nice-to-have')
                .map(s => ({
                    skill: s.name,
                    importance: s.importance,
                    targetLevel: s.minLevel,
                    estimatedHours: s.minLevel === 'expert' ? 100 : s.minLevel === 'advanced' ? 60 : 30
                })),
            isQualified: matchScore >= 95
        },
        experienceLevel: jobRole.experience_level,
        salaryRange: {
            min: jobRole.salary_range_min,
            max: jobRole.salary_range_max
        },
        demandScore: jobRole.demand_score
    };
}

/**
 * Check if user level meets minimum required level
 */
function meetsMinLevel(userLevel, requiredLevel) {
    const levels = ['beginner', 'intermediate', 'advanced', 'expert'];
    const userIndex = levels.indexOf(userLevel?.toLowerCase() || 'beginner');
    const requiredIndex = levels.indexOf(requiredLevel?.toLowerCase() || 'beginner');
    return userIndex >= requiredIndex;
}

// =============================================
// TOP MATCHES & RECOMMENDATIONS
// =============================================

/**
 * Get top N job matches for a user
 * @param {Array} userSkills - User's skills
 * @param {Array} jobRoles - All available job roles
 * @param {number} topN - Number of top matches to return
 * @param {string} interests - User's declared interests
 * @returns {Array} Top job matches sorted by score
 */
function getTopJobMatches(userSkills, jobRoles, topN = 5, interests = "") {
    const matches = jobRoles.map(job => calculateJobMatch(userSkills, job, interests));

    // Sort by score descending, then by demand score
    matches.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (b.demandScore || 0) - (a.demandScore || 0);
    });

    return matches.slice(0, topN);
}

/**
 * Get job matches filtered by experience level
 */
function getMatchesByExperience(userSkills, jobRoles, experienceLevel) {
    const filteredRoles = jobRoles.filter(job =>
        job.experience_level === experienceLevel
    );
    return getTopJobMatches(userSkills, filteredRoles, 10);
}

// =============================================
// SKILL GAP ANALYSIS
// =============================================

/**
 * Analyze skill gaps across top job matches
 * @param {Array} topMatches - Top job match results
 * @returns {Array} Prioritized list of skills to learn
 */
function getSkillGaps(topMatches) {
    const skillGaps = new Map();

    for (const match of topMatches) {
        for (const missing of match.missingSkills || []) {
            const key = missing.name.toLowerCase();

            if (!skillGaps.has(key)) {
                skillGaps.set(key, {
                    name: missing.name,
                    category: missing.category,
                    minLevel: missing.minLevel,
                    importance: missing.importance,
                    neededFor: [match.jobTitle],
                    priority: missing.importance === 'required' ? 2 : 1
                });
            } else {
                const existing = skillGaps.get(key);
                existing.neededFor.push(match.jobTitle);
                // Increase priority if needed for multiple jobs
                existing.priority += missing.importance === 'required' ? 2 : 1;
            }
        }
    }

    // Sort by priority (skills needed for more jobs ranked higher)
    return Array.from(skillGaps.values())
        .sort((a, b) => b.priority - a.priority);
}

/**
 * Get skills that would most improve job matches
 */
function getMostImpactfulSkillsToLearn(topMatches, limit = 5) {
    const gaps = getSkillGaps(topMatches);

    // Filter to only required skills that appear in multiple jobs
    return gaps
        .filter(g => g.importance === 'required')
        .slice(0, limit)
        .map(g => ({
            skill: g.name,
            category: g.category,
            targetLevel: g.minLevel,
            neededFor: g.neededFor,
            impactScore: g.priority
        }));
}

// =============================================
// CAREER PATH SUGGESTIONS
// =============================================

/**
 * Suggest career progression based on current skills
 */
function suggestCareerPath(userSkills, jobRoles) {
    // Get matches at each experience level
    const entryMatches = getMatchesByExperience(userSkills, jobRoles, 'entry');
    const midMatches = getMatchesByExperience(userSkills, jobRoles, 'mid');
    const seniorMatches = getMatchesByExperience(userSkills, jobRoles, 'senior');

    // Find best entry point
    const bestEntry = entryMatches[0];

    // Find related mid-level role
    const relatedMid = midMatches.find(m =>
        m.jobTitle.includes(bestEntry?.jobTitle?.split(' ')[0] || '')
    ) || midMatches[0];

    // Find related senior role
    const relatedSenior = seniorMatches.find(m =>
        m.jobTitle.includes(bestEntry?.jobTitle?.split(' ')[0] || '')
    ) || seniorMatches[0];

    return {
        currentFit: bestEntry,
        nextStep: relatedMid,
        longTermGoal: relatedSenior,
        skillsForNextLevel: relatedMid ?
            relatedMid.missingSkills.slice(0, 5) : []
    };
}

// =============================================
// EXPORTS
// =============================================

module.exports = {
    calculateJobMatch,
    getTopJobMatches,
    getMatchesByExperience,
    getSkillGaps,
    getMostImpactfulSkillsToLearn,
    suggestCareerPath
};
