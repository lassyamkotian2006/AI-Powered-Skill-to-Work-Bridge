/**
 * OTP Service - FIXED VERSION
 * -----------
 * Handles generation and verification of One-Time Passwords.
 * Uses HMAC tokens for verification.
 * Codes expire quickly (default 60s) and ONLY the latest OTP per email is accepted.
 */

const crypto = require('crypto');
const generateOTP = require('../utils/generateOTP');
const { sendOTP: sendOTPEmail } = require('./emailService');

// Secret for HMAC signing
const HMAC_SECRET = process.env.SESSION_SECRET || 'skill-bridge-otp-secret';
const OTP_EXPIRY_SECONDS = Math.max(10, parseInt(process.env.OTP_EXPIRY_SECONDS || '60', 10) || 60);

// In-memory "latest OTP per email" guard.
// Prevents old codes from being valid after resend.
// Note: resets on server restart (acceptable for short-lived OTPs).
const latestOtpByEmail = new Map();

/**
 * Create an HMAC token that encodes email + code + timestamp.
 */
function createToken(email, code, timestamp) {
    const payload = `${email}:${code}:${timestamp}`;
    return crypto.createHmac('sha256', HMAC_SECRET).update(payload).digest('hex');
}

/**
 * Generate a 6-digit OTP for a given email and send it via email.
 * Returns { code, token, timestamp, emailSent, deliveryMethod }.
 */
async function generateOTPForEmail(email) {
    if (!email) throw new Error("Email is required for OTP generation");

    const normalizedEmail = email.trim().toLowerCase();
    const code = generateOTP();
    const timestamp = Date.now();

    // Create HMAC token for stateless verification
    const token = createToken(normalizedEmail, code, timestamp);

    // Mark this as the latest OTP for this email
    latestOtpByEmail.set(normalizedEmail, { token, timestamp });

    console.log(`\n-----------------------------------------`);
    console.log(`🔐 OTP for ${normalizedEmail}: ${code}`);
    console.log(`   Token: ${token.substring(0, 20)}...`);
    console.log(`   Expires: ${new Date(timestamp + OTP_EXPIRY_SECONDS * 1000).toISOString()}`);
    console.log(`-----------------------------------------\n`);

    let emailSent = false;
    let deliveryMethod = 'console';

    // Try email delivery
    if (process.env.BREVO_API_KEY || process.env.RESEND_API_KEY || 
        (process.env.EMAIL_USER && process.env.EMAIL_PASS)) {
        try {
            await sendOTPEmail(normalizedEmail, code);
            emailSent = true;
            
            if (process.env.BREVO_API_KEY) deliveryMethod = 'brevo';
            else if (process.env.RESEND_API_KEY) deliveryMethod = 'resend';
            else deliveryMethod = 'gmail-smtp';
            
            console.log(`📧 Email sent via ${deliveryMethod} to ${normalizedEmail}`);
        } catch (error) {
            console.error(`❌ Email delivery failed for ${normalizedEmail}:`, error.message);
            deliveryMethod = 'failed';
        }
    } else {
        console.warn(`⚠️ No email provider configured. OTP only in console.`);
    }

    return { code, token, timestamp, emailSent, deliveryMethod };
}

/**
 * Verify an OTP using HMAC token (stateless - survives server restarts).
 * NOTE: Does NOT consume the OTP - can be verified multiple times within validity window.
 */
function verifyOTP(email, code, token, timestamp) {
    if (!email || !code) {
        console.log('❌ verifyOTP: Missing email or code');
        return false;
    }

    if (!token || !timestamp) {
        console.log('❌ verifyOTP: Missing token or timestamp');
        return false;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const codeStr = String(code).trim();
    const ts = Number(timestamp);

    // Only accept latest OTP for this email
    const latest = latestOtpByEmail.get(normalizedEmail);
    if (!latest || latest.token !== token || latest.timestamp !== ts) {
        console.log(`❌ OTP verification failed - not latest code`);
        return false;
    }

    // Check expiration
    const elapsed = Date.now() - ts;
    if (elapsed > OTP_EXPIRY_SECONDS * 1000) {
        console.log(`❌ OTP expired (${Math.round(elapsed / 1000)}s elapsed, max ${OTP_EXPIRY_SECONDS}s)`);
        return false;
    }

    if (elapsed < 0) {
        console.log('❌ OTP timestamp is in the future');
        return false;
    }

    // Verify HMAC token
    const expectedToken = createToken(normalizedEmail, codeStr, ts);
    const isValid = token === expectedToken;

    if (isValid) {
        console.log(`✅ OTP verified for ${normalizedEmail}`);
    } else {
        console.log(`❌ OTP verification failed - HMAC mismatch`);
    }

    return isValid;
}

/**
 * Validate OTP format without full verification
 */
function validateOTPFormat(email, code) {
    if (!email || !email.includes('@')) {
        return { valid: false, reason: 'Invalid email format' };
    }
    if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
        return { valid: false, reason: 'Code must be exactly 6 digits' };
    }
    return { valid: true, reason: null };
}

module.exports = {
    generateOTP: generateOTPForEmail,
    verifyOTP,
    validateOTPFormat
};
