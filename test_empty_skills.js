const jobMatcher = require('./server/src/services/jobMatcher');

const jobRoles = jobMatcher.getHardcodedJobRoles();
const emptySkills = [];
const interests = "Frontend Developer, UI Design";

console.log("--- Testing Match with Empty Skills but Interests ---");
const matches = jobMatcher.getTopJobMatches(emptySkills, jobRoles, 5, interests);

matches.forEach(m => {
    console.log(`Job: ${m.jobTitle}, Score: ${m.score}%, Interest Boost: ${m.interestBoost || 'N/A'}`);
});

if (matches.length === 0) {
    console.log("❌ No matches found for empty skills + interests.");
} else {
    console.log(`✅ Found ${matches.length} matches!`);
}
