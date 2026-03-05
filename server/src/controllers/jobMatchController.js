const { generateMatches } = require("../services/jobMatcherAI");

exports.generateJobMatches = async (req, res) => {

  try {

    const { skills } = req.body;

    if (!skills || skills.length === 0) {
      return res.status(400).json({
        error: "Skills required"
      });
    }

    const result = generateMatches(skills);

    return res.json(result);

  } catch (err) {

    console.error("Job match error:", err);

    return res.status(500).json({
      error: "Job matching failed"
    });

  }

};
