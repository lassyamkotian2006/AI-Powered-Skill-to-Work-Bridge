const { suggestJobRolesWithAI } = require("../services/ai");
const dbService = require("../services/supabaseService");

// Comprehensive fallback mapper when AI is unavailable
const FALLBACK_ROLE_MAP = {
    security: ["Security Engineer", "Cybersecurity Analyst", "Application Security Engineer", "DevSecOps Engineer", "Security Researcher"],
    react: ["React Developer", "Frontend Developer", "UI Engineer", "Web Developer", "Frontend Architect"],
    frontend: ["Frontend Developer", "React Developer", "UI Engineer", "Web Developer", "Frontend Architect"],
    node: ["Backend Developer", "Node.js Developer", "API Engineer", "Server Engineer", "Platform Engineer"],
    backend: ["Backend Developer", "Node.js Developer", "API Engineer", "Server Engineer", "Platform Engineer"],
    data: ["Data Scientist", "Data Analyst", "Machine Learning Engineer", "AI Engineer", "Analytics Engineer"],
    python: ["Python Developer", "Data Scientist", "Backend Developer", "ML Engineer", "Automation Engineer"],
    devops: ["DevOps Engineer", "Cloud Engineer", "Site Reliability Engineer", "Platform Engineer", "Infrastructure Engineer"],
    docker: ["DevOps Engineer", "Cloud Engineer", "Site Reliability Engineer", "Platform Engineer", "Infrastructure Engineer"],
    kubernetes: ["DevOps Engineer", "Cloud Architect", "Site Reliability Engineer", "Platform Engineer", "Infrastructure Engineer"],
    figma: ["UI Designer", "UX Designer", "Product Designer", "Interaction Designer", "UI/UX Specialist"],
    design: ["UI Designer", "UX Designer", "Product Designer", "Interaction Designer", "UI/UX Specialist"],
    mobile: ["Mobile Developer", "React Native Developer", "iOS Developer", "Android Developer", "Flutter Developer"],
    aws: ["Cloud Engineer", "DevOps Engineer", "Cloud Architect", "AWS Developer", "Solutions Architect"],
    azure: ["Cloud Engineer", "DevOps Engineer", "Cloud Architect", "Azure Developer", "Solutions Architect"],
    ml: ["Machine Learning Engineer", "AI Engineer", "Data Scientist", "ML Researcher", "Deep Learning Engineer"],
    tensorflow: ["Machine Learning Engineer", "AI Engineer", "Deep Learning Engineer", "ML Researcher", "Computer Vision Engineer"],
    java: ["Java Developer", "Backend Developer", "Spring Boot Developer", "Enterprise Developer", "Android Developer"],
    typescript: ["TypeScript Developer", "Frontend Developer", "React Developer", "Full Stack Developer", "Node.js Developer"],
    javascript: ["JavaScript Developer", "Frontend Developer", "Full Stack Developer", "Web Developer", "Backend Developer"],
    sql: ["Database Developer", "Data Analyst", "Backend Developer", "SQL Developer", "Data Engineer"],
    postgresql: ["Database Developer", "Backend Developer", "Data Engineer", "PostgreSQL Developer", "Data Analyst"],
    mongodb: ["MongoDB Developer", "Backend Developer", "NoSQL Developer", "Full Stack Developer", "Data Engineer"],
    testing: ["QA Engineer", "SDET", "Test Automation Engineer", "Quality Engineer", "Software Tester"],
    selenium: ["QA Engineer", "Test Automation Engineer", "SDET", "Quality Engineer", "Software Tester"],
    documentation: ["Technical Writer", "Developer Advocate", "Documentation Engineer", "API Writer", "Content Developer"],
    flutter: ["Flutter Developer", "Mobile Developer", "Cross-Platform Developer", "App Developer", "Mobile Engineer"],
    rust: ["Rust Developer", "Systems Programmer", "Backend Developer", "Blockchain Developer", "Performance Engineer"],
    go: ["Go Developer", "Backend Developer", "Cloud Engineer", "DevOps Engineer", "Microservices Developer"],
    csharp: ["C# Developer", ".NET Developer", "Unity Developer", "Backend Developer", "Full Stack Developer"],
    blockchain: ["Blockchain Developer", "Smart Contract Developer", "Web3 Developer", "Solidity Developer", "DeFi Engineer"],
    solidity: ["Solidity Developer", "Smart Contract Developer", "Blockchain Developer", "Web3 Developer", "DeFi Engineer"],
    game: ["Game Developer", "Unity Developer", "Unreal Developer", "Game Programmer", "Gameplay Engineer"],
    c: ["C Developer", "Systems Programmer", "Embedded Engineer", "Firmware Developer", "Low-Level Developer"],
    cpp: ["C++ Developer", "Game Developer", "Systems Programmer", "Embedded Engineer", "Performance Engineer"],
    ruby: ["Ruby Developer", "Rails Developer", "Backend Developer", "Full Stack Developer", "Web Developer"],
    php: ["PHP Developer", "Laravel Developer", "Backend Developer", "Web Developer", "Full Stack Developer"],
    swift: ["iOS Developer", "Swift Developer", "Mobile Developer", "Apple Developer", "macOS Developer"],
    kotlin: ["Android Developer", "Kotlin Developer", "Mobile Developer", "Backend Developer", "Multiplatform Developer"],
    linux: ["DevOps Engineer", "Systems Administrator", "Linux Engineer", "Platform Engineer", "SRE"],
    git: ["Software Developer", "Full Stack Developer", "Backend Developer", "Frontend Developer", "DevOps Engineer"],
    ci: ["DevOps Engineer", "Platform Engineer", "SRE", "Release Engineer", "Automation Engineer"],
    redis: ["Backend Developer", "Database Engineer", "Cache Engineer", "Performance Engineer", "Systems Engineer"],
    sass: ["Frontend Developer", "CSS Developer", "UI Developer", "Web Developer", "React Developer"],
    tailwind: ["Frontend Developer", "React Developer", "UI Developer", "Web Developer", "Vue Developer"],
    angular: ["Angular Developer", "Frontend Developer", "Web Developer", "TypeScript Developer", "UI Engineer"],
    vue: ["Vue Developer", "Frontend Developer", "Web Developer", "JavaScript Developer", "UI Engineer"],
    django: ["Django Developer", "Python Developer", "Backend Developer", "Web Developer", "API Developer"],
    flask: ["Flask Developer", "Python Developer", "Backend Developer", "API Developer", "Microservices Developer"],
    fastapi: ["FastAPI Developer", "Python Developer", "API Developer", "Backend Developer", "Microservices Developer"],
    spring: ["Java Developer", "Spring Developer", "Backend Developer", "Enterprise Developer", "Microservices Developer"],
    laravel: ["Laravel Developer", "PHP Developer", "Backend Developer", "Web Developer", "Full Stack Developer"],
    next: ["Next.js Developer", "Full Stack Developer", "React Developer", "Frontend Developer", "Web Developer"],
    express: ["Node.js Developer", "Backend Developer", "API Developer", "Full Stack Developer", "Server Engineer"],
    graphql: ["GraphQL Developer", "API Developer", "Full Stack Developer", "Backend Developer", "Frontend Developer"],
    terraform: ["DevOps Engineer", "Cloud Engineer", "Infrastructure Engineer", "Platform Engineer", "SRE"],
    jenkins: ["DevOps Engineer", "CI/CD Engineer", "Release Engineer", "Platform Engineer", "Automation Engineer"],
    githubactions: ["DevOps Engineer", "CI/CD Engineer", "Platform Engineer", "Release Engineer", "Automation Engineer"],
    pandas: ["Data Scientist", "Data Analyst", "Python Developer", "ML Engineer", "Data Engineer"],
    numpy: ["Data Scientist", "ML Engineer", "Python Developer", "Data Analyst", "AI Engineer"],
    deeplearning: ["Deep Learning Engineer", "AI Engineer", "ML Researcher", "Computer Vision Engineer", "NLP Engineer"],
    nlp: ["NLP Engineer", "AI Engineer", "Data Scientist", "ML Engineer", "Research Scientist"],
    computervision: ["Computer Vision Engineer", "AI Engineer", "ML Engineer", "Research Scientist", "Deep Learning Engineer"],
    tableau: ["Data Analyst", "Business Intelligence Analyst", "Data Scientist", "Analytics Engineer", "BI Developer"],
    powerbi: ["Data Analyst", "Business Intelligence Analyst", "Power BI Developer", "Analytics Engineer", "BI Developer"],
    excel: ["Data Analyst", "Business Analyst", "Financial Analyst", "Operations Analyst", "Reporting Analyst"],
    jira: ["Product Manager", "Scrum Master", "Project Manager", "Agile Coach", "Business Analyst"],
    agile: ["Product Manager", "Scrum Master", "Project Manager", "Agile Coach", "Delivery Manager"],
    product: ["Product Manager", "Technical Product Manager", "Associate PM", "Product Owner", "Growth PM"],
    ui: ["UI Designer", "UX Designer", "Product Designer", "Visual Designer", "Interface Designer"],
    ux: ["UX Designer", "UX Researcher", "Product Designer", "Interaction Designer", "User Researcher"],
    writing: ["Technical Writer", "Documentation Engineer", "Content Developer", "API Writer", "Developer Advocate"],
    network: ["Network Engineer", "Security Engineer", "Systems Administrator", "Infrastructure Engineer", "Cloud Engineer"],
    penetration: ["Penetration Tester", "Security Engineer", "Security Analyst", "Ethical Hacker", "Security Consultant"],
    owasp: ["Security Engineer", "Application Security Engineer", "Security Analyst", "DevSecOps Engineer", "Security Consultant"],
    cryptography: ["Security Engineer", "Cryptographer", "Blockchain Developer", "Security Researcher", "Privacy Engineer"],
    audit: ["Security Auditor", "Compliance Analyst", "Security Consultant", "Risk Analyst", "IT Auditor"],
    unity: ["Game Developer", "Unity Developer", "Mobile Game Developer", "AR/VR Developer", "Gameplay Programmer"],
    unreal: ["Game Developer", "Unreal Developer", "3D Programmer", "Gameplay Programmer", "Technical Artist"],
    web3: ["Web3 Developer", "Blockchain Developer", "Smart Contract Developer", "DeFi Engineer", "DApp Developer"]
};

function getFallbackRoles(skills, focus) {
    const skillString = skills.join(" ").toLowerCase();
    const focusString = (focus || "").toLowerCase();
    const combined = skillString + " " + focusString;

    // Score each domain by keyword matches
    const domainScores = {};
    
    for (const [domain, roleList] of Object.entries(FALLBACK_ROLE_MAP)) {
        let score = 0;
        
        // Direct domain keyword match in combined string
        if (combined.includes(domain)) {
            score += 10;
        }
        
        // Check each skill against domain
        for (const skill of skills) {
            const skillLower = skill.toLowerCase();
            if (skillLower.includes(domain) || domain.includes(skillLower)) {
                score += 5;
            }
        }
        
        // Focus/interest boost
        if (focusString.includes(domain)) {
            score += 8;
        }
        
        if (score > 0) {
            domainScores[domain] = score;
        }
    }

    // Sort domains by score
    const sortedDomains = Object.entries(domainScores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

    // Default to software if no matches
    if (sortedDomains.length === 0) {
        return {
            domain: "SOFTWARE",
            roles: ["Software Developer", "Full Stack Developer", "Software Engineer", "Application Developer", "Technology Consultant"]
        };
    }

    // Collect unique roles from top domains
    const seenRoles = new Set();
    const roles = [];
    
    for (const [domain] of sortedDomains) {
        for (const role of FALLBACK_ROLE_MAP[domain]) {
            if (!seenRoles.has(role)) {
                seenRoles.add(role);
                roles.push(role);
            }
        }
    }

    // Map domain key to display name
    const domainNameMap = {
        security: "CYBERSECURITY",
        react: "FRONTEND DEVELOPMENT",
        frontend: "FRONTEND DEVELOPMENT",
        node: "BACKEND DEVELOPMENT",
        backend: "BACKEND DEVELOPMENT",
        data: "DATA SCIENCE",
        python: "PYTHON DEVELOPMENT",
        devops: "DEVOPS & CLOUD",
        docker: "DEVOPS & CONTAINERS",
        kubernetes: "DEVOPS & ORCHESTRATION",
        figma: "UI/UX DESIGN",
        design: "UI/UX DESIGN",
        mobile: "MOBILE DEVELOPMENT",
        aws: "CLOUD (AWS)",
        azure: "CLOUD (AZURE)",
        ml: "MACHINE LEARNING",
        tensorflow: "AI/ML ENGINEERING",
        deeplearning: "DEEP LEARNING",
        java: "JAVA DEVELOPMENT",
        typescript: "TYPESCRIPT DEVELOPMENT",
        javascript: "JAVASCRIPT DEVELOPMENT",
        sql: "DATABASE DEVELOPMENT",
        postgresql: "POSTGRESQL DEVELOPMENT",
        mongodb: "NOSQL DEVELOPMENT",
        testing: "QUALITY ASSURANCE",
        selenium: "TEST AUTOMATION",
        documentation: "TECHNICAL WRITING",
        flutter: "FLUTTER DEVELOPMENT",
        rust: "RUST DEVELOPMENT",
        go: "GO DEVELOPMENT",
        csharp: ".NET DEVELOPMENT",
        blockchain: "BLOCKCHAIN",
        solidity: "SOLIDITY / SMART CONTRACTS",
        game: "GAME DEVELOPMENT",
        c: "C / SYSTEMS PROGRAMMING",
        cpp: "C++ DEVELOPMENT",
        ruby: "RUBY DEVELOPMENT",
        php: "PHP DEVELOPMENT",
        swift: "IOS / SWIFT DEVELOPMENT",
        kotlin: "KOTLIN / ANDROID DEVELOPMENT",
        linux: "LINUX / SYSTEMS ADMINISTRATION",
        git: "SOFTWARE ENGINEERING",
        ci: "CI/CD ENGINEERING",
        redis: "CACHING / IN-MEMORY DATABASES",
        sass: "CSS PREPROCESSING",
        tailwind: "UTILITY-FIRST CSS",
        angular: "ANGULAR DEVELOPMENT",
        vue: "VUE.JS DEVELOPMENT",
        django: "DJANGO DEVELOPMENT",
        flask: "FLASK DEVELOPMENT",
        fastapi: "FASTAPI DEVELOPMENT",
        spring: "SPRING / JAVA DEVELOPMENT",
        laravel: "LARAVEL / PHP DEVELOPMENT",
        next: "NEXT.JS DEVELOPMENT",
        express: "EXPRESS.JS DEVELOPMENT",
        graphql: "GRAPHQL DEVELOPMENT",
        terraform: "INFRASTRUCTURE AS CODE",
        jenkins: "CI/CD (JENKINS)",
        githubactions: "CI/CD (GITHUB ACTIONS)",
        pandas: "DATA ANALYSIS",
        numpy: "SCIENTIFIC COMPUTING",
        nlp: "NLP ENGINEERING",
        computervision: "COMPUTER VISION",
        tableau: "BUSINESS INTELLIGENCE",
        powerbi: "POWER BI DEVELOPMENT",
        excel: "DATA ANALYTICS",
        jira: "PROJECT MANAGEMENT",
        agile: "AGILE / SCRUM",
        product: "PRODUCT MANAGEMENT",
        ui: "UI DESIGN",
        ux: "UX DESIGN / RESEARCH",
        writing: "TECHNICAL WRITING",
        network: "NETWORKING",
        penetration: "PENETRATION TESTING",
        owasp: "APPLICATION SECURITY",
        cryptography: "CRYPTOGRAPHY",
        audit: "SECURITY AUDITING",
        unity: "UNITY GAME DEVELOPMENT",
        unreal: "UNREAL ENGINE DEVELOPMENT",
        web3: "WEB3 / BLOCKCHAIN",
        ai: "ARTIFICIAL INTELLIGENCE"
    };

    const topDomain = sortedDomains[0][0];
    return {
        domain: domainNameMap[topDomain] || topDomain.toUpperCase(),
        roles: roles.slice(0, 5)
    };
}

function inferDomainFromRoles(roles, skills) {
    const roleString = roles.join(" ").toLowerCase();
    
    const domainKeywords = {
        "FRONTEND DEVELOPMENT": ["frontend", "react", "vue", "angular", "ui engineer", "web developer"],
        "BACKEND DEVELOPMENT": ["backend", "node", "api engineer", "server engineer", "spring"],
        "FULL STACK DEVELOPMENT": ["full stack", "fullstack", "mern", "mean"],
        "DATA SCIENCE": ["data scientist", "data analyst", "analytics engineer"],
        "MACHINE LEARNING": ["machine learning", "ml engineer", "ai engineer", "deep learning"],
        "DEVOPS & CLOUD": ["devops", "sre", "site reliability", "platform engineer", "cloud"],
        "MOBILE DEVELOPMENT": ["mobile", "ios", "android", "react native", "flutter"],
        "CYBERSECURITY": ["security", "cybersecurity", "penetration", "devsecops"],
        "UI/UX DESIGN": ["ui designer", "ux designer", "product designer", "interaction"],
        "QUALITY ASSURANCE": ["qa", "test", "sdet", "quality", "automation engineer"],
        "TECHNICAL WRITING": ["technical writer", "documentation", "developer advocate"],
        "GAME DEVELOPMENT": ["game developer", "unity", "unreal", "gameplay"],
        "BLOCKCHAIN": ["blockchain", "smart contract", "web3", "solidity", "defi"],
        "CLOUD ENGINEERING": ["cloud", "aws", "azure", "gcp", "infrastructure"],
        "PYTHON DEVELOPMENT": ["python developer", "django", "flask", "fastapi"],
        "JAVA DEVELOPMENT": ["java developer", "spring boot", "enterprise"],
        "PRODUCT MANAGEMENT": ["product manager", "product owner", "scrum"]
    };

    let bestDomain = "SOFTWARE ENGINEERING";
    let bestScore = 0;

    for (const [domain, keywords] of Object.entries(domainKeywords)) {
        let score = 0;
        for (const keyword of keywords) {
            if (roleString.includes(keyword)) {
                score++;
            }
        }
        if (score > bestScore) {
            bestScore = score;
            bestDomain = domain;
        }
    }

    return bestDomain;
}

exports.generateJobMatches = async (req, res) => {
    try {
        const skills = req.body.skills || [];
        let focus = req.body.interest || "";

        // If focus is empty, check if user has a stored targetRole
        if (!focus && req.session.user) {
            const user = await dbService.getUserById(req.session.user.id);
            focus = user?.target_role || "";
        }

        if (!skills || skills.length === 0) {
            return res.status(400).json({
                error: "Skills required",
                message: "Please analyze your repositories first to extract skills"
            });
        }

        console.log(`\n🎯 Generating job matches for ${skills.length} skills: ${skills.slice(0, 5).join(', ')}${skills.length > 5 ? '...' : ''}`);
        console.log(`   Focus/Interest: ${focus || 'none'}`);

        // Try AI-powered role suggestion first
        let result = null;
        
        try {
            const aiRoles = await suggestJobRolesWithAI(skills, focus);
            if (aiRoles && aiRoles.length >= 3) {
                const domain = inferDomainFromRoles(aiRoles, skills);
                result = {
                    domain: domain,
                    roles: aiRoles,
                    isAI: true
                };
                console.log(`✅ AI generated ${aiRoles.length} roles for domain: ${domain}`);
            }
        } catch (aiError) {
            console.log(`⚠️ AI role suggestion unavailable: ${aiError.message}`);
        }

        // Fallback to comprehensive keyword-based matching
        if (!result) {
            result = getFallbackRoles(skills, focus);
            result.isAI = false;
            console.log(`📋 Fallback generated ${result.roles.length} roles for domain: ${result.domain}`);
        }

        return res.json(result);

    } catch (err) {
        console.error("❌ Job match error:", err);
        return res.status(500).json({
            error: "Job matching failed",
            message: err.message
        });
    }
};
