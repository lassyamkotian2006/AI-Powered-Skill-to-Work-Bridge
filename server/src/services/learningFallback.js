/**
 * Learning Fallback
 * -----------------
 * Generates a dynamic learning path for roles not found
 * in roleSkillMap (completely unknown roles).
 *
 * Instead of a generic 5-step list, it breaks the role name
 * into actionable learning steps based on the role itself.
 */

const learningResources = require('./learningResources');

function generateFallbackPath(role) {
    // Parse the role name for domain hints
    const roleLower = role.toLowerCase();

    // Pick domain-specific starter skills based on keywords in the role title
    const domainSkills = [];

    if (roleLower.includes('front') || roleLower.includes('ui') || roleLower.includes('web')) {
        domainSkills.push('HTML', 'CSS', 'JavaScript', 'React', 'TypeScript');
    }
    if (roleLower.includes('back') || roleLower.includes('server') || roleLower.includes('api')) {
        domainSkills.push('Node.js', 'REST APIs', 'Databases', 'Authentication');
    }
    if (roleLower.includes('data') || roleLower.includes('analytics') || roleLower.includes('analyst')) {
        domainSkills.push('Python', 'SQL', 'Statistics', 'Data Visualization');
    }
    if (roleLower.includes('machine learning') || roleLower.includes('ml') || roleLower.includes('ai')) {
        domainSkills.push('Python', 'Machine Learning', 'Deep Learning', 'TensorFlow');
    }
    if (roleLower.includes('devops') || roleLower.includes('infrastructure') || roleLower.includes('sre')) {
        domainSkills.push('Linux', 'Docker', 'Kubernetes', 'CI/CD', 'Cloud Computing');
    }
    if (roleLower.includes('security') || roleLower.includes('cyber')) {
        domainSkills.push('Network Security', 'Penetration Testing', 'OWASP', 'Linux');
    }
    if (roleLower.includes('mobile') || roleLower.includes('ios') || roleLower.includes('android')) {
        domainSkills.push('JavaScript', 'React Native', 'Mobile UI Design', 'REST APIs');
    }
    if (roleLower.includes('cloud') || roleLower.includes('aws') || roleLower.includes('azure')) {
        domainSkills.push('AWS', 'Cloud Computing', 'Docker', 'Infrastructure as Code');
    }
    if (roleLower.includes('game')) {
        domainSkills.push('C++', 'Game Engines', '3D Mathematics', 'Graphics Programming');
    }
    if (roleLower.includes('blockchain') || roleLower.includes('web3')) {
        domainSkills.push('Solidity', 'Smart Contracts', 'Cryptography', 'JavaScript');
    }

    // Deduplicate
    const uniqueSkills = [...new Set(domainSkills)];

    // If we detected domain skills, build a dynamic roadmap
    if (uniqueSkills.length > 0) {
        const roadmapSteps = uniqueSkills.map((skill, i) =>
            `Step ${i + 1}: Learn ${skill}`
        );
        roadmapSteps.push(`Step ${uniqueSkills.length + 1}: Build a project combining your new skills`);
        roadmapSteps.push(`Step ${uniqueSkills.length + 2}: Apply for ${role} positions`);

        const resourceItems = uniqueSkills.map(skill => {
            const resource = learningResources[skill];
            if (resource) {
                return `${skill} → ${resource.title} (${resource.url})`;
            }
            return `${skill} → Search: https://www.youtube.com/results?search_query=${encodeURIComponent(skill)}+tutorial`;
        });

        return [
            {
                title: 'Skill Gaps',
                items: uniqueSkills.map(skill => `${skill} — recommended for ${role}`)
            },
            {
                title: 'Learning Roadmap',
                items: roadmapSteps
            },
            {
                title: 'Recommended Resources',
                items: resourceItems
            }
        ];
    }

    // Truly unknown domain — provide a generic but still structured roadmap
    return [
        {
            title: 'Learning Roadmap',
            items: [
                `Step 1: Research the core skills required for a ${role}`,
                `Step 2: Study the foundational tools and frameworks used by ${role}s`,
                `Step 3: Build beginner projects to apply your learning`,
                `Step 4: Create a portfolio showcasing your ${role} skills`,
                `Step 5: Practice problem-solving and interview preparation`,
                `Step 6: Apply for ${role} internships and entry-level positions`
            ]
        }
    ];
}

module.exports = { generateFallbackPath };
