/**
 * OTP Service
 * -----------
 * Handles generation, storage, and verification of One-Time Passwords.
 * Uses Gmail SMTP for sending verification emails.
 * Codes expire after 10 minutes.
 */

const otps = new Map();
const generateOTP = require('../utils/generateOTP');
const { sendOTPEmail } = require('./emailService');

/**
 * Generate a 6-digit OTP for a given email
 */
async function generateOTPForEmail(email) {
    const code = generateOTP();
    const expiry = Date.now() + 10 * 60 * 1000; // 10 minutes

    otps.set(email, { code, expiry });

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        throw new Error('Missing EMAIL_USER or EMAIL_PASS environment variables');
    }

    // Real delivery: if sending fails, throw so the route returns non-2xx
    await sendOTPEmail(email, code);

    return code;
}

/**
 * Verify an OTP for a given email
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
