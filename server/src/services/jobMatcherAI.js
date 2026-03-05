const domainSkills = {
    frontend: ["react", "html", "css", "javascript", "typescript", "next", "vue"],
    backend: ["node", "express", "java", "spring", "django", "flask"],
    data: ["python", "pandas", "numpy", "tensorflow", "pytorch", "sql"],
    devops: ["docker", "kubernetes", "aws", "terraform", "ci", "cd"],
    uiux: ["figma", "adobe xd", "design", "ui", "ux"]
};

const domainRoles = {
    frontend: [
        "Frontend Developer",
        "React Developer",
        "UI Engineer",
        "Web Developer",
        "Frontend Architect"
    ],
    backend: [
        "Backend Developer",
        "Node.js Developer",
        "API Engineer",
        "Software Engineer",
        "Platform Engineer"
    ],
    data: [
        "Data Analyst",
        "Data Scientist",
        "Machine Learning Engineer",
        "AI Engineer",
        "Business Intelligence Analyst"
    ],
    devops: [
        "DevOps Engineer",
        "Cloud Engineer",
        "Site Reliability Engineer",
        "Infrastructure Engineer",
        "Platform DevOps Engineer"
    ],
    uiux: [
        "UI Designer",
        "UX Designer",
        "Product Designer",
        "Interaction Designer",
        "UI/UX Specialist"
    ]
};

function detectDomain(skills) {
    const scores = {};

    for (const domain in domainSkills) {
        scores[domain] = 0;

        skills.forEach(skill => {
            const lower = skill.toLowerCase();

            if (domainSkills[domain].some(ds => lower.includes(ds))) {
                scores[domain]++;
            }
        });
    }

    return Object.keys(scores).reduce((a, b) => scores[a] > scores[b] ? a : b);
}

exports.generateMatches = (skills) => {

    const domain = detectDomain(skills);

    const roles = domainRoles[domain] || [
        "Software Developer",
        "Technology Specialist",
        "Software Engineer"
    ];

    return {
        domain: domain.toUpperCase(),
        roles
    };
};
