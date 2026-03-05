function generateJobMatches(skills, focus) {

    const skillString = skills.join(" ").toLowerCase();
    const focusString = (focus || "").toLowerCase();

    const combined = skillString + " " + focusString;

    if (combined.includes("security") || combined.includes("cyber")) {
        return {
            domain: "CYBERSECURITY",
            roles: [
                "Security Engineer",
                "Cybersecurity Analyst",
                "Application Security Engineer",
                "DevSecOps Engineer",
                "Security Researcher"
            ]
        };
    }

    if (combined.includes("react") || combined.includes("frontend")) {
        return {
            domain: "FRONTEND",
            roles: [
                "Frontend Developer",
                "React Developer",
                "UI Engineer",
                "Web Developer",
                "Frontend Architect"
            ]
        };
    }

    if (combined.includes("node") || combined.includes("backend")) {
        return {
            domain: "BACKEND",
            roles: [
                "Backend Developer",
                "Node.js Developer",
                "API Engineer",
                "Server Engineer",
                "Platform Engineer"
            ]
        };
    }

    if (combined.includes("data") || combined.includes("python")) {
        return {
            domain: "DATA",
            roles: [
                "Data Scientist",
                "Data Analyst",
                "Machine Learning Engineer",
                "AI Engineer",
                "Analytics Engineer"
            ]
        };
    }

    if (combined.includes("devops") || combined.includes("docker")) {
        return {
            domain: "DEVOPS",
            roles: [
                "DevOps Engineer",
                "Cloud Engineer",
                "Site Reliability Engineer",
                "Platform Engineer",
                "Infrastructure Engineer"
            ]
        };
    }

    if (combined.includes("figma") || combined.includes("design") || combined.includes("ui") || combined.includes("ux")) {
        return {
            domain: "UI/UX",
            roles: [
                "UI Designer",
                "UX Designer",
                "Product Designer",
                "Interaction Designer",
                "UI/UX Specialist"
            ]
        };
    }

    return {
        domain: "SOFTWARE",
        roles: [
            "Software Developer",
            "Full Stack Developer",
            "Software Engineer",
            "Application Developer",
            "Technology Engineer"
        ]
    };

}

module.exports = { generateJobMatches };
