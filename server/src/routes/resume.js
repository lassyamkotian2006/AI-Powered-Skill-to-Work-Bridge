/**
 * Resume Generator Routes (Student-focused)
 * ------------------------------------------
 * API endpoint for AI-powered resume generation:
 * - POST /resume/generate - Generate a polished student resume using Groq AI
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const Groq = require('groq-sdk');

const router = express.Router();

// Initialize Groq client
const groq = process.env.GROQ_API_KEY
    ? new Groq({ apiKey: process.env.GROQ_API_KEY })
    : null;

const RESUME_SYSTEM_PROMPT = `You are an expert resume writer specializing in student and early-career resumes. Given a student's personal details, education, internships, projects, co-curricular activities, and technical skills, generate a polished, professional resume.

IMPORTANT: Output ONLY valid JSON in this exact format, no other text:
{
    "summary": "A compelling 2-3 sentence professional summary (objective statement) tailored to the student's skills, education, and aspirations",
    "education": [
        {
            "institution": "University Name",
            "degree": "Degree and Major",
            "duration": "Start - End",
            "details": "GPA, honors, relevant coursework (if provided)"
        }
    ],
    "internships": [
        {
            "company": "Company Name",
            "role": "Intern Title",
            "duration": "Start - End",
            "bullets": ["Achievement-focused bullet using action verbs and metrics", "..."]
        }
    ],
    "projects": [
        {
            "name": "Project Name",
            "technologies": "Tech stack used",
            "bullets": ["Key accomplishment or technical detail", "..."]
        }
    ],
    "cocurricular": [
        {
            "activity": "Activity or Organization Name",
            "role": "Your Role",
            "bullets": ["Impact or achievement", "..."]
        }
    ],
    "skillCategories": [
        {
            "category": "Languages",
            "skills": ["JavaScript", "Python", "..."]
        },
        {
            "category": "Frameworks & Tools",
            "skills": ["React", "Node.js", "..."]
        }
    ],
    "certifications": ["Certification name (if any)"]
}

Rules:
- Write achievement-focused bullet points using strong action verbs (Built, Developed, Implemented, Designed, Led, Organized, etc.)
- Include quantifiable metrics where possible (e.g., "Improved performance by 30%", "Managed a team of 5")
- Keep the summary/objective concise (2-3 sentences)
- Organize skills into logical categories (Languages, Frameworks, Tools, Databases, etc.)
- If the user provides minimal info, still generate professional-sounding content based on what's available
- Do NOT fabricate institutions, companies, or activities the user didn't mention
- DO enhance and polish descriptions the user provides
- Focus on making the student stand out for entry-level positions or higher education`;

/**
 * POST /resume/generate
 * Generate a polished student resume using AI
 */
router.post('/generate', requireAuth, async (req, res) => {
    try {
        const { personalInfo, education, internships, projects, cocurricular, certifications, skills } = req.body;

        console.log(`\n📄 Generating student resume for: ${personalInfo?.name || req.session.user.login}`);

        // Merge session skills with provided skills
        let allSkills = skills || [];
        if (req.session.extractedSkills && allSkills.length === 0) {
            allSkills = req.session.extractedSkills.map(s => ({
                name: s.name,
                category: s.category,
                level: s.level
            }));
        }

        // Build the prompt
        const prompt = buildResumePrompt(personalInfo, education, internships, projects, cocurricular, certifications, allSkills);

        let resumeData;

        if (groq) {
            try {
                const response = await groq.chat.completions.create({
                    model: 'llama-3.1-70b-versatile',
                    messages: [
                        { role: 'system', content: RESUME_SYSTEM_PROMPT },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.4,
                    max_tokens: 3000
                });

                const content = response.choices[0].message.content;
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    resumeData = JSON.parse(jsonMatch[0]);
                }
            } catch (aiError) {
                console.error('AI resume generation error:', aiError.message);
            }
        }

        // Fallback if AI is not available or fails
        if (!resumeData) {
            resumeData = buildFallbackResume(personalInfo, education, internships, projects, cocurricular, certifications, allSkills);
        }

        // Attach the personal info to the response
        resumeData.personalInfo = {
            name: personalInfo?.name || req.session.user.login,
            email: personalInfo?.email || '',
            phone: personalInfo?.phone || '',
            linkedin: personalInfo?.linkedin || '',
            github: req.session.user.profileUrl || `https://github.com/${req.session.user.login}`,
            portfolio: personalInfo?.portfolio || ''
        };

        console.log('✅ Student resume generated successfully\n');

        res.json({
            success: true,
            resume: resumeData
        });

    } catch (error) {
        console.error('❌ Resume generation error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate resume',
            message: error.message
        });
    }
});

/**
 * Build the AI prompt from user data
 */
function buildResumePrompt(personalInfo, education, internships, projects, cocurricular, certifications, skills) {
    const sections = [];

    sections.push(`STUDENT CANDIDATE: ${personalInfo?.name || 'Not provided'}`);
    sections.push(`EMAIL: ${personalInfo?.email || 'Not provided'}`);

    if (education && education.length > 0) {
        sections.push('\nEDUCATION:');
        education.forEach(edu => {
            sections.push(`- ${edu.degree || 'Degree'} at ${edu.institution || 'Institution'} (${edu.startYear || ''} - ${edu.endYear || 'Present'})`);
            if (edu.gpa) sections.push(`  GPA: ${edu.gpa}`);
            if (edu.coursework) sections.push(`  Relevant coursework: ${edu.coursework}`);
        });
    }

    if (internships && internships.length > 0) {
        sections.push('\nINTERNSHIPS:');
        internships.forEach(int => {
            sections.push(`- ${int.role || 'Intern'} at ${int.company || 'Company'} (${int.startDate || ''} - ${int.endDate || 'Present'})`);
            if (int.description) sections.push(`  Description: ${int.description}`);
        });
    }

    if (projects && projects.length > 0) {
        sections.push('\nPROJECTS:');
        projects.forEach(proj => {
            sections.push(`- ${proj.name || 'Project'}: ${proj.description || 'No description'}`);
            if (proj.technologies) sections.push(`  Technologies: ${proj.technologies}`);
        });
    }

    if (cocurricular && cocurricular.length > 0) {
        sections.push('\nCO-CURRICULAR ACTIVITIES:');
        cocurricular.forEach(act => {
            sections.push(`- ${act.activity || 'Activity'} (Role: ${act.role || 'Member'})`);
            if (act.description) sections.push(`  Description: ${act.description}`);
        });
    }

    if (certifications && certifications.length > 0) {
        const validCerts = certifications.filter(c => c.trim());
        if (validCerts.length > 0) {
            sections.push('\nCERTIFICATIONS:');
            validCerts.forEach(cert => sections.push(`- ${cert}`));
        }
    }

    if (skills && skills.length > 0) {
        sections.push('\nTECHNICAL SKILLS (from GitHub analysis):');
        skills.forEach(s => {
            sections.push(`- ${s.name} (${s.category || 'general'}, ${s.level || 'intermediate'})`);
        });
    }

    sections.push('\nPlease generate a polished, professional STUDENT resume from the above information. Enhance descriptions with action verbs and make them achievement-focused. This is for a student seeking internships or entry-level positions.');

    return sections.join('\n');
}

/**
 * Fallback resume when AI is not available
 */
function buildFallbackResume(personalInfo, education, internships, projects, cocurricular, certifications, skills) {
    // Group skills by category
    const skillMap = {};
    for (const s of (skills || [])) {
        const cat = s.category || 'other';
        const label = cat === 'language' ? 'Languages' :
            cat === 'framework' ? 'Frameworks & Libraries' :
                cat === 'database' ? 'Databases' :
                    cat === 'tool' ? 'Tools & DevOps' :
                        cat === 'cloud' ? 'Cloud Services' :
                            cat === 'concept' ? 'Concepts' : 'Other';
        if (!skillMap[label]) skillMap[label] = [];
        skillMap[label].push(s.name);
    }

    return {
        summary: personalInfo?.name
            ? `Motivated student with hands-on experience in ${(skills || []).slice(0, 3).map(s => s.name).join(', ') || 'modern technologies'}. Passionate about building impactful projects and eager to contribute to innovative teams.`
            : 'Motivated student passionate about technology and software development.',
        education: (education || []).map(edu => ({
            institution: edu.institution || '',
            degree: edu.degree || '',
            duration: `${edu.startYear || ''} - ${edu.endYear || 'Present'}`,
            details: [edu.gpa ? `GPA: ${edu.gpa}` : '', edu.coursework ? `Coursework: ${edu.coursework}` : ''].filter(Boolean).join(' | ')
        })),
        internships: (internships || []).map(int => ({
            company: int.company || '',
            role: int.role || '',
            duration: `${int.startDate || ''} - ${int.endDate || 'Present'}`,
            bullets: int.description
                ? [int.description]
                : ['Contributed to development projects and collaborated with the team']
        })),
        projects: (projects || []).map(proj => ({
            name: proj.name || '',
            technologies: proj.technologies || '',
            bullets: proj.description
                ? [proj.description]
                : ['Developed and maintained project features']
        })),
        cocurricular: (cocurricular || []).map(act => ({
            activity: act.activity || '',
            role: act.role || '',
            bullets: act.description
                ? [act.description]
                : ['Actively participated and contributed to the organization']
        })),
        skillCategories: Object.entries(skillMap).map(([category, skillList]) => ({
            category,
            skills: skillList
        })),
        certifications: (certifications || []).filter(c => c && c.trim())
    };
}

module.exports = router;
