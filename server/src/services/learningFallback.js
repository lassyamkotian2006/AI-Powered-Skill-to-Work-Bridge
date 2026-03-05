const roleRoadmaps = {

    "Frontend Developer": [
        "Master HTML, CSS, and modern JavaScript",
        "Learn React or another modern frontend framework",
        "Understand responsive design and accessibility",
        "Build real-world frontend projects",
        "Learn API integration and state management"
    ],

    "Backend Developer": [
        "Learn Node.js or Java Spring Boot",
        "Understand REST API design",
        "Master databases such as PostgreSQL or MongoDB",
        "Learn authentication and security practices",
        "Build scalable backend services"
    ],

    "Data Scientist": [
        "Learn Python programming",
        "Study statistics and probability",
        "Use libraries like Pandas and NumPy",
        "Learn machine learning fundamentals",
        "Build ML projects and analyze datasets"
    ],

    "DevOps Engineer": [
        "Learn Linux fundamentals",
        "Understand Docker and containerization",
        "Study Kubernetes orchestration",
        "Learn CI/CD pipelines",
        "Practice cloud deployment using AWS or GCP"
    ],

    "UI Designer": [
        "Learn UI design principles",
        "Master tools like Figma",
        "Study UX research and usability",
        "Create design systems",
        "Build portfolio design projects"
    ]

};

function generateFallbackPath(role) {

    const steps = roleRoadmaps[role] || [
        "Learn programming fundamentals",
        "Master data structures and algorithms",
        "Study system design basics",
        "Build real-world projects",
        "Contribute to open source"
    ];

    return [
        {
            title: "Learning Roadmap",
            items: steps
        }
    ];
}

module.exports = { generateFallbackPath };
