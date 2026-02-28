const Groq = require("groq-sdk");

const groqClient = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

exports.generateJobMatches = async (req, res) => {
  try {
    const { skills, interest } = req.body;

    // Validate skills
    if (!Array.isArray(skills) || skills.length === 0) {
      return res.status(400).json({
        error: "Skills array is required",
      });
    }

    const prompt = `
You are a professional AI career advisor.

User Technical Skills:
${skills.join(", ")}

User Career Interest:
${interest || "Not specified"}

Your task:
1. Identify the most suitable professional domain.
2. Suggest 5 specific job roles based strictly on the skills.
3. Avoid overly generic roles unless clearly justified.
4. Return ONLY valid JSON.

Return format:

{
  "domain": "Domain Name",
  "roles": [
    "Role 1",
    "Role 2",
    "Role 3",
    "Role 4",
    "Role 5"
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
      // Extract JSON block safely
      const jsonMatch = aiOutput.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON block found");
      }
    } catch (error) {
      console.log("JSON parsing failed. Using fallback roles.");

      parsed = {
        domain: "General Software Development",
        roles: [
          "Software Developer",
          "Application Developer",
          "Web Developer",
          "Backend Developer",
          "Frontend Developer",
        ],
      };
    }

    // Safety check
    if (!parsed.roles || parsed.roles.length === 0) {
      parsed.roles = [
        "Software Developer",
        "Application Developer",
        "Web Developer",
        "Backend Developer",
        "Frontend Developer",
      ];
    }

    return res.json(parsed);
  } catch (err) {
    console.error("Job matching error:", err);
    return res.status(500).json({
      error: "Server error in job matching",
    });
  }
};
