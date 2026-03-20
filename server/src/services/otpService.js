/**
 * OTP Service
 * -----------
 * Handles generation, storage, and verification of One-Time Passwords.
 * Delegates email sending to the shared emailService.
 * Codes expire after 10 minutes.
 */

const otps = new Map();
const generateOTP = require('../utils/generateOTP');
const { sendOTP: sendOTPEmail } = require('./emailService');

/**
 * Generate a 6-digit OTP for a given email and send it via email.
 * Falls back to console-only if email credentials are not configured.
 */
async function generateOTPForEmail(email) {
    const code = generateOTP();
    const expiry = Date.now() + 10 * 60 * 1000; // 10 minutes

    otps.set(email, { code, expiry });

    // Always log to console as a fallback / debugging aid
    console.log(`\n-----------------------------------------`);
    console.log(`🔐 SECURITY: OTP for ${email} is: ${code}`);
    console.log(`-----------------------------------------\n`);

    let emailSent = false;

    // Send actual email if any provider is configured (Resend or SMTP)
    if (process.env.RESEND_API_KEY || (process.env.EMAIL_USER && process.env.EMAIL_PASS)) {
        try {
            await sendOTPEmail(email, code);
            emailSent = true;
            console.log(`📧 Email sent successfully to ${email}`);
        } catch (error) {
            console.error(`❌ Failed to send email to ${email}:`, error.message);
            if (error.response) console.error('   SMTP response:', error.response);
        }
    } else {
        console.warn(`⚠️  Email not configured. OTP for ${email} logged to console only.`);
    }

    return { code, emailSent };
}

/**
 * Verify an OTP for a given email.
 * Returns true if the code is valid and has not expired. One-time use.
 */
function verifyOTP(email, code) {
    const record = otps.get(email);

    if (!record) return false;

    if (Date.now() > record.expiry) {
        otps.delete(email);
        return false;
    }

    if (record.code === code) {
        otps.delete(email); // One-time use
        return true;
    }

    return false;
}

module.exports = {
    generateOTP: generateOTPForEmail,
    verifyOTP
};
