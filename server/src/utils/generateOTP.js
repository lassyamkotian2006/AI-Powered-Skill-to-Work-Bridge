function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString()
}

// Backwards compatible:
// - existing code may `require('../utils/generateOTP')` and call it directly
// - new code may `const { generateOTP } = require('../utils/generateOTP')`
module.exports = generateOTP
module.exports.generateOTP = generateOTP
