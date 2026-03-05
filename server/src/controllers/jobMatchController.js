const { generateJobMatches } = require("../services/jobMatcherAI");

exports.generateJobMatches = async (req, res) => {

  try {

    const skills = req.body.skills || [];
    const focus = req.body.interest || "";

    if (!skills || skills.length === 0) {
      return res.status(400).json({
        error: "Skills required"
      });
    }

    const result = generateJobMatches(skills, focus);

    return res.json(result);

  } catch (err) {

    console.error("Job match error:", err);

    return res.status(500).json({
      error: "Job matching failed"
    });

  }

};
