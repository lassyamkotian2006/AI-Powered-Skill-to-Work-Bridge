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
 * Emails are normalized to lowercase.
 */
async function generateOTPForEmail(email) {
    if (!email) throw new Error("Email is required for OTP generation");

    const normalizedEmail = email.trim().toLowerCase();
    const code = generateOTP();
    const expiry = Date.now() + 10 * 60 * 1000; // 10 minutes

    otps.set(normalizedEmail, { code, expiry });

    // Always log to console as a fallback / debugging aid
    console.log(`\n-----------------------------------------`);
    console.log(`🔐 SECURITY: OTP for ${normalizedEmail} is: ${code}`);
    console.log(`-----------------------------------------\n`);

    let emailSent = false;

    // Send actual email if any provider is configured (Resend or SMTP)
    if (process.env.RESEND_API_KEY || (process.env.EMAIL_USER && process.env.EMAIL_PASS)) {
        try {
            await sendOTPEmail(normalizedEmail, code);
            emailSent = true;
            console.log(`📧 Email sent successfully to ${normalizedEmail}`);
        } catch (error) {
            console.error(`❌ Failed to send email to ${normalizedEmail}:`, error.message);
        }
    } else {
        console.warn(`⚠️  Email not configured. OTP for ${normalizedEmail} logged to console only.`);
    }

    return { code, emailSent };
}

/**
 * Verify an OTP for a given email.
 * Emails are normalized to lowercase.
 * Returns true if the code is valid and has not expired. One-time use.
 */
function verifyOTP(email, code) {
    if (!email || !code) return false;

    const normalizedEmail = email.trim().toLowerCase();
    const record = otps.get(normalizedEmail);

    console.log(`🔑 Verification attempt: ${normalizedEmail} with code ${code}`);

    if (!record) {
        console.log(`❌ No OTP record found for ${normalizedEmail}`);
        return false;
    }

    if (Date.now() > record.expiry) {
        console.log(`❌ OTP for ${normalizedEmail} has expired`);
        otps.delete(normalizedEmail);
        return false;
    }

    // Force string comparison to avoid type issues
    const isMatch = String(record.code) === String(code);

    if (isMatch) {
        console.log(`✅ OTP match for ${normalizedEmail}`);
        otps.delete(normalizedEmail); // One-time use
        return true;
    }

    console.log(`❌ OTP mismatch for ${normalizedEmail}. Expected ${record.code}, got ${code}`);
    return false;
}

module.exports = {
    generateOTP: generateOTPForEmail,
    verifyOTP
};
