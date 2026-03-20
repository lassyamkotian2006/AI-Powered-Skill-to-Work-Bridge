/**
 * Role-to-Skill Mapping
 * ---------------------
 * Maps job roles to the skills they require.
 * Used by the learning path system to calculate skill gaps.
 *
 * When a user targets a role, the system compares their existing
 * skills against this map to find missing skills and generate
 * a personalised roadmap with resources.
 */

const roleSkillMap = {

    // ── Frontend ──────────────────────────────────
    "Frontend Developer": [
        "HTML", "CSS", "JavaScript", "React",
        "TypeScript", "Responsive Design",
        "Web Performance", "Testing"
    ],

    "React Developer": [
        "HTML", "CSS", "JavaScript", "React",
        "TypeScript", "State Management",
        "Testing", "Web Performance"
    ],

    "UI Engineer": [
        "HTML", "CSS", "JavaScript", "React",
        "TypeScript", "UI Architecture",
        "Web Performance", "Testing"
    ],

    "Web Developer": [
        "HTML", "CSS", "JavaScript", "React",
        "Node.js", "REST APIs", "Databases", "Git"
    ],

    "Frontend Architect": [
        "JavaScript", "React", "TypeScript",
        "Design Systems", "Web Performance",
        "Testing", "System Design", "CI/CD"
    ],

    "Angular Developer": [
        "HTML", "CSS", "TypeScript", "JavaScript",
        "State Management", "Testing",
        "REST APIs", "Web Performance"
    ],

    "Vue.js Developer": [
        "HTML", "CSS", "JavaScript", "TypeScript",
        "State Management", "Testing",
        "REST APIs", "Web Performance"
    ],

    // ── Backend ───────────────────────────────────
    "Backend Developer": [
        "Node.js", "REST APIs", "Databases",
        "Authentication", "Security", "Docker"
    ],

    "Node.js Developer": [
        "JavaScript", "Node.js", "REST APIs",
        "Databases", "Authentication",
        "Testing", "Docker"
    ],

    "Java Developer": [
        "Programming Fundamentals", "Data Structures",
        "Algorithms", "REST APIs", "Databases",
        "Testing", "Docker"
    ],

    "Python Developer": [
        "Python", "REST APIs", "Databases",
        "Testing", "Docker", "Git"
    ],

    "API Developer": [
        "REST APIs", "Node.js", "Databases",
        "Authentication", "Testing",
        "Docker", "Security"
    ],

    // ── Full Stack ────────────────────────────────
    "Full Stack Developer": [
        "HTML", "CSS", "JavaScript", "React",
        "Node.js", "Databases", "REST APIs", "Git"
    ],

    "MERN Stack Developer": [
        "JavaScript", "React", "Node.js",
        "Databases", "REST APIs",
        "Git", "Docker"
    ],

    // ── Mobile ────────────────────────────────────
    "Mobile Developer": [
        "JavaScript", "React Native",
        "Mobile UI Design", "REST APIs", "Testing"
    ],

    "iOS Developer": [
        "Programming Fundamentals", "Mobile UI Design",
        "REST APIs", "Testing", "Git"
    ],

    "Android Developer": [
        "Programming Fundamentals", "Mobile UI Design",
        "REST APIs", "Databases", "Testing", "Git"
    ],

    "Flutter Developer": [
        "Programming Fundamentals", "Mobile UI Design",
        "REST APIs", "Testing", "Git"
    ],

    // ── Data & AI ─────────────────────────────────
    "Data Scientist": [
        "Python", "Statistics", "Pandas",
        "Machine Learning", "Data Visualization"
    ],

    "Data Analyst": [
        "Python", "SQL", "Statistics",
        "Data Visualization", "Excel"
    ],

    "Data Engineer": [
        "Python", "SQL", "Databases",
        "Data Pipelines", "Cloud Computing",
        "Docker"
    ],

    "Machine Learning Engineer": [
        "Python", "Machine Learning", "Deep Learning",
        "TensorFlow", "Data Pipelines"
    ],

    "AI Engineer": [
        "Python", "Machine Learning", "Deep Learning",
        "Natural Language Processing", "Cloud Computing"
    ],

    "NLP Engineer": [
        "Python", "Natural Language Processing",
        "Machine Learning", "Deep Learning",
        "Statistics"
    ],

    "Computer Vision Engineer": [
        "Python", "Deep Learning", "TensorFlow",
        "Machine Learning", "Statistics"
    ],

    "AI Research Scientist": [
        "Python", "Machine Learning", "Deep Learning",
        "Statistics", "Algorithms",
        "Data Structures"
    ],

    // ── DevOps & Cloud ────────────────────────────
    "DevOps Engineer": [
        "Linux", "Docker", "Kubernetes",
        "CI/CD", "Cloud Computing"
    ],

    "Cloud Engineer": [
        "AWS", "Docker", "Kubernetes",
        "Networking", "Infrastructure as Code"
    ],

    "Cloud Architect": [
        "AWS", "Cloud Computing", "Kubernetes",
        "Infrastructure as Code", "Networking",
        "Security", "System Design"
    ],

    "Site Reliability Engineer": [
        "Linux", "Docker", "Kubernetes",
        "CI/CD", "Cloud Computing",
        "Networking", "System Design"
    ],

    "Platform Engineer": [
        "Linux", "Docker", "Kubernetes",
        "CI/CD", "Infrastructure as Code",
        "Cloud Computing"
    ],

    // ── Security ──────────────────────────────────
    "Security Engineer": [
        "Network Security", "Penetration Testing",
        "Security Auditing", "Cryptography", "OWASP"
    ],

    "Cybersecurity Analyst": [
        "Network Security", "Linux",
        "Penetration Testing", "OWASP",
        "Security Auditing"
    ],

    "Cybersecurity Engineer": [
        "Network Security", "Linux",
        "Penetration Testing", "Cryptography",
        "Cloud Computing", "OWASP"
    ],

    // ── General Engineering ───────────────────────
    "Software Developer": [
        "Programming Fundamentals", "Data Structures",
        "Algorithms", "Version Control",
        "Testing", "System Design"
    ],

    "Software Engineer": [
        "Programming Fundamentals", "Data Structures",
        "Algorithms", "System Design",
        "Testing", "Databases"
    ],

    "QA Engineer": [
        "Testing", "Programming Fundamentals",
        "Git", "CI/CD", "REST APIs"
    ],

    "Technical Lead": [
        "System Design", "Programming Fundamentals",
        "Data Structures", "Algorithms",
        "Testing", "CI/CD", "Git"
    ],

    // ── Specialised ───────────────────────────────
    "Game Developer": [
        "C++", "Game Engines", "3D Mathematics",
        "Physics Simulation", "Graphics Programming"
    ],

    "Blockchain Developer": [
        "Solidity", "Smart Contracts",
        "Cryptography", "Distributed Systems",
        "JavaScript"
    ],

    "Embedded Systems Engineer": [
        "C++", "Programming Fundamentals",
        "Networking", "Linux", "Testing"
    ],

    "Database Administrator": [
        "SQL", "Databases", "Linux",
        "Security", "Cloud Computing"
    ],

    "UI/UX Designer": [
        "HTML", "CSS", "Responsive Design",
        "UI Architecture", "Testing"
    ],

    "Product Manager": [
        "Data Visualization", "SQL",
        "REST APIs", "System Design"
    ]
};

module.exports = roleSkillMap;
