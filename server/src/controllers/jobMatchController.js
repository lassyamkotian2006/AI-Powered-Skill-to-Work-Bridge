const { generateJobMatches } = require("../services/jobMatcherAI");
const dbService = require("../services/supabaseService");

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
