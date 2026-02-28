const Groq = require("groq-sdk");

const groqClient = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

exports.generateJobMatches = async (req, res) => {
    try {
        const { skills, interest } = req.body;

        if (!Array.isArray(skills) || skills.length === 0) {
            return res.status(400).json({ error: "Skills array is required" });
        }

        const prompt = `
You are a career AI expert.

User technical skills:
${skills.join(", ")}

User interest/goal:
${interest || "Not specified"}

Task:
1. Identify the most appropriate professional domain for these skills.
2. Then list 5 specific job roles within that domain that match these skills.
3. Be specific, avoid generic roles like "Software Engineer" unless strongly justified.

Return ONLY valid JSON in this format:

{
  "domain": "<domain>",
  "roles": [
    "<role1>",
    "<role2>",
    ...
  ]
}
`;

        const response = await groqClient.chat.completions.create({
            model: "llama3-8b-8192",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.8,
        });

        const aiOutput = response.choices[0].message.content;
        console.log("AI RAW OUTPUT:", aiOutput);

        let parsed;
        try {
            parsed = JSON.parse(aiOutput);
        } catch (err) {
            const lines = aiOutput
                .split("\n")
                .map(l => l.replace(/^\d+\.\s*/, "").trim())
                .filter(l => l && !l.includes("{") && !l.includes("}"));

            parsed = {
                domain: lines.shift() || "Unknown",
                roles: lines.slice(0, 5),
            };
        }

        if (!parsed.roles || parsed.roles.length === 0) {
            return res.status(500).json({ error: "AI could not generate job roles" });
        }

        return res.json(parsed);
    } catch (err) {
        console.error("Job matching error:", err);
        return res.status(500).json({ error: "Server error in job matching" });
    }
};
