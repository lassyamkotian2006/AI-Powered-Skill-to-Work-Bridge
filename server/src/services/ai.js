/**
 * AI Service for Skill Extraction
 * --------------------------------
 * Uses Groq API (LLaMA models) to analyze GitHub repositories
 * and extract technical skills with proficiency levels.
 */

const Groq = require('groq-sdk');

// Initialize Groq client
const groq = process.env.GROQ_API_KEY
    ? new Groq({ apiKey: process.env.GROQ_API_KEY })
    : null;

// =============================================
// SKILL EXTRACTION
// =============================================

/**
 * Extract skills from a single repository
 * @param {Object} repoData - Repository with languages, readme, commits
 * @returns {Array} Extracted skills with confidence levels
 */
async function extractSkillsFromRepo(repoData) {
    if (!groq) {
        console.warn('⚠️ Groq API not configured - using fallback extraction');
        return extractSkillsFallback(repoData);
    }

    const prompt = buildSkillExtractionPrompt(repoData);

    try {
        const response = await groq.chat.completions.create({
            model: 'llama-3.1-70b-versatile',
            messages: [
                {
                    role: 'system',
                    content: SKILL_EXTRACTION_SYSTEM_PROMPT
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.3,
            max_tokens: 2000
        });

        const content = response.choices[0].message.content;
        return parseSkillsFromAIResponse(content);

    } catch (error) {
        console.error('AI skill extraction error:', error.message);
        return extractSkillsFallback(repoData);
    }
}

/**
 * System prompt for skill extraction
 */
const SKILL_EXTRACTION_SYSTEM_PROMPT = `You are a technical recruiter AI that analyzes GitHub repositories to identify developer skills.

Your task is to:
1. Identify ALL technical skills used in the repository
2. Estimate proficiency level based on code complexity and usage patterns
3. Provide a confidence score for each skill identification

IMPORTANT: Output ONLY valid JSON in this exact format, no other text:
{
    "skills": [
        {
            "name": "JavaScript",
            "category": "language",
            "level": "intermediate",
            "confidence": 0.85,
            "evidence": ["Primary language in repo", "Uses ES6+ features"]
        }
    ]
}

Proficiency levels (choose one):
- "beginner": Basic usage, simple patterns, learning project
- "intermediate": Functional code, moderate complexity, standard practices
- "advanced": Production-quality, best practices, complex patterns
- "expert": Highly optimized, advanced architecture, deep expertise

Categories (choose one):
- "language": Programming languages (JavaScript, Python, etc.)
- "framework": Frameworks and libraries (React, Express, Django, etc.)
- "database": Database technologies (PostgreSQL, MongoDB, etc.)
- "tool": Development tools (Docker, Git, etc.)
- "cloud": Cloud platforms and services (AWS, Azure, etc.)
- "concept": Development concepts (REST API, CI/CD, etc.)

Confidence: A number between 0.0 and 1.0 indicating how confident you are.`;

/**
 * Build the prompt for skill extraction from repo data
 */
function buildSkillExtractionPrompt(repoData) {
    const languagesStr = repoData.languages
        ? Object.entries(repoData.languages)
            .map(([lang, bytes]) => `${lang}: ${bytes} bytes`)
            .join('\n')
        : 'No languages detected';

    const commitsStr = repoData.commits?.length > 0
        ? repoData.commits.slice(0, 5).map(c => `- ${c.message}`).join('\n')
        : 'No recent commits';

    const readmeStr = repoData.readme
        ? repoData.readme.substring(0, 3000)
        : 'No README available';

    return `Analyze this GitHub repository and extract ALL technical skills:

REPOSITORY: ${repoData.name || 'Unknown'}
DESCRIPTION: ${repoData.description || 'No description'}

LANGUAGES DETECTED:
${languagesStr}

README CONTENT (first 3000 chars):
${readmeStr}

RECENT COMMITS:
${commitsStr}

Analyze the above information and identify:
1. Programming languages used
2. Frameworks and libraries (look in README, package files, imports)
3. Databases mentioned
4. Tools and technologies
5. Cloud services
6. Development patterns and concepts

Return your analysis as JSON.`;
}

/**
 * Parse skills from AI response
 */
function parseSkillsFromAIResponse(content) {
    try {
        // Try to find JSON in the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return parsed.skills || [];
        }
    } catch (error) {
        console.error('Error parsing AI response:', error.message);
    }
    return [];
}

/**
 * Fallback skill extraction when AI is not available
 * Uses language detection and simple pattern matching
 */
function extractSkillsFallback(repoData) {
    const skills = [];

    // Extract from languages
    if (repoData.languages && typeof repoData.languages === 'object') {
        const totalBytes = Object.values(repoData.languages).reduce((a, b) => a + b, 0);

        for (const [lang, bytes] of Object.entries(repoData.languages)) {
            const percentage = bytes / totalBytes;
            let level = 'beginner';
            if (percentage > 0.5) level = 'advanced';
            else if (percentage > 0.2) level = 'intermediate';

            skills.push({
                name: lang,
                category: 'language',
                level,
                confidence: Math.min(0.9, percentage + 0.4),
                evidence: [`${Math.round(percentage * 100)}% of codebase`]
            });
        }
    }

    // Extract from README patterns
    const readme = (repoData.readme || '').toLowerCase();
    const patterns = [
        { name: 'React', category: 'framework', pattern: /react/i },
        { name: 'Vue.js', category: 'framework', pattern: /vue/i },
        { name: 'Angular', category: 'framework', pattern: /angular/i },
        { name: 'Node.js', category: 'framework', pattern: /node\.?js|express/i },
        { name: 'Django', category: 'framework', pattern: /django/i },
        { name: 'Flask', category: 'framework', pattern: /flask/i },
        { name: 'Docker', category: 'tool', pattern: /docker/i },
        { name: 'Kubernetes', category: 'tool', pattern: /kubernetes|k8s/i },
        { name: 'PostgreSQL', category: 'database', pattern: /postgres|postgresql/i },
        { name: 'MongoDB', category: 'database', pattern: /mongo/i },
        { name: 'AWS', category: 'cloud', pattern: /aws|amazon web services/i },
        { name: 'REST API', category: 'concept', pattern: /rest\s*api|restful/i },
        { name: 'GraphQL', category: 'concept', pattern: /graphql/i },
    ];

    for (const { name, category, pattern } of patterns) {
        if (pattern.test(readme) && !skills.find(s => s.name === name)) {
            skills.push({
                name,
                category,
                level: 'intermediate',
                confidence: 0.6,
                evidence: ['Mentioned in README']
            });
        }
    }

    return skills;
}

// =============================================
// AGGREGATE SKILLS FROM ALL REPOS
// =============================================

/**
 * Analyze multiple repositories and aggregate skills
 * @param {Array} repos - Array of repository objects with details
 * @returns {Array} Aggregated skills across all repos
 */
async function analyzeAllRepos(repos) {
    const allSkills = new Map();

    console.log(`🔍 Analyzing ${repos.length} repositories...`);

    for (const repo of repos) {
        try {
            console.log(`  📂 Analyzing: ${repo.name}`);
            const skills = await extractSkillsFromRepo(repo);

            for (const skill of skills) {
                const key = skill.name.toLowerCase();
                const existing = allSkills.get(key);

                if (existing) {
                    // Upgrade if this repo shows higher proficiency
                    existing.repoCount++;
                    existing.confidence = Math.max(existing.confidence, skill.confidence);
                    existing.evidence = [...new Set([...existing.evidence, ...skill.evidence])];

                    // Upgrade proficiency level if higher
                    const levels = ['beginner', 'intermediate', 'advanced', 'expert'];
                    if (levels.indexOf(skill.level) > levels.indexOf(existing.level)) {
                        existing.level = skill.level;
                    }
                } else {
                    allSkills.set(key, {
                        ...skill,
                        name: skill.name, // Preserve original casing
                        repoCount: 1
                    });
                }
            }
        } catch (error) {
            console.error(`  ❌ Error analyzing ${repo.name}:`, error.message);
        }
    }

    const result = Array.from(allSkills.values());
    console.log(`✅ Found ${result.length} unique skills`);
    return result;
}

// =============================================
// JOB RECOMMENDATION AI
// =============================================

/**
 * Generate AI-powered job recommendation text
 */
async function generateJobRecommendation(userSkills, jobRole) {
    if (!groq) {
        return `Based on your skills, you're a good match for ${jobRole.title}!`;
    }

    const prompt = `You are a career advisor. Based on these skills:
${userSkills.slice(0, 10).map(s => `- ${s.name} (${s.level})`).join('\n')}

Write a brief, encouraging 2-3 sentence recommendation for the role: ${jobRole.title}

Be specific about which skills make them a good fit. Be positive and motivating.`;

    try {
        const response = await groq.chat.completions.create({
            model: 'llama-3.1-70b-versatile',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 200
        });

        return response.choices[0].message.content;
    } catch (error) {
        console.error('Job recommendation AI error:', error.message);
        return `Based on your skills, you're a good match for ${jobRole.title}!`;
    }
}

/**
 * Generate learning path suggestions using AI
 */
async function generateLearningAdvice(skill, currentLevel, targetLevel) {
    if (!groq) {
        return `To improve your ${skill} skills from ${currentLevel} to ${targetLevel}, focus on building practical projects and studying best practices.`;
    }

    const prompt = `Give brief, practical advice (2-3 sentences) for improving ${skill} skills from ${currentLevel} to ${targetLevel} level. Include one specific resource suggestion.`;

    try {
        const response = await groq.chat.completions.create({
            model: 'llama-3.1-70b-versatile',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 150
        });

        return response.choices[0].message.content;
    } catch (error) {
        return `To improve your ${skill} skills, focus on building projects and practicing regularly.`;
    }
}

// =============================================
// EXPORTS
// =============================================

module.exports = {
    extractSkillsFromRepo,
    analyzeAllRepos,
    generateJobRecommendation,
    generateLearningAdvice
};
