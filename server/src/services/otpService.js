/**
 * OTP Service
 * -----------
 * Handles generation and verification of One-Time Passwords.
 * Uses HMAC tokens for STATELESS verification that survives server restarts.
 * Also keeps in-memory fallback for local development.
 * Codes expire after 10 minutes.
 */

const crypto = require('crypto');
const generateOTP = require('../utils/generateOTP');
const { sendOTP: sendOTPEmail } = require('./emailService');

// In-memory fallback (not reliable on Render free tier – server restarts wipe this)
const otps = new Map();

// Secret for HMAC signing – reuses SESSION_SECRET for convenience
const HMAC_SECRET = process.env.SESSION_SECRET || 'skill-bridge-otp-secret';

/**
 * Create an HMAC token that encodes email + code + timestamp.
 * This lets us verify the OTP without any server-side state.
 */
function createToken(email, code, timestamp) {
    const payload = `${email}:${code}:${timestamp}`;
    return crypto.createHmac('sha256', HMAC_SECRET).update(payload).digest('hex');
}

/**
 * Generate a 6-digit OTP for a given email and send it via email.
 * Returns { code, token, timestamp, emailSent }.
 */
async function generateOTPForEmail(email) {
    if (!email) throw new Error("Email is required for OTP generation");

    const normalizedEmail = email.trim().toLowerCase();
    const code = generateOTP();
    const timestamp = Date.now();

    // Create HMAC token for stateless verification
    const token = createToken(normalizedEmail, code, timestamp);

    // Also store in memory as fallback (works on local dev)
    otps.set(normalizedEmail, { code, expiry: timestamp + 10 * 60 * 1000 });

    console.log(`\n-----------------------------------------`);
    console.log(`🔐 OTP for ${normalizedEmail}: ${code}`);
    console.log(`-----------------------------------------\n`);

    let emailSent = false;

    if (process.env.RESEND_API_KEY || (process.env.EMAIL_USER && process.env.EMAIL_PASS)) {
        try {
            await sendOTPEmail(normalizedEmail, code);
            emailSent = true;
            console.log(`📧 Email sent to ${normalizedEmail}`);
        } catch (error) {
            console.error(`❌ Email failed for ${normalizedEmail}:`, error.message);
        }
    } else {
        console.warn(`⚠️ No email provider. OTP logged to console only.`);
    }

    return { code, token, timestamp, emailSent };
}

/**
 * Verify an OTP.
 * Method 1: HMAC token verification (stateless – survives server restarts)
 * Method 2: In-memory lookup (fallback for old callers / local dev)
 */
function verifyOTP(email, code, token, timestamp) {
    if (!email || !code) return false;

    const normalizedEmail = email.trim().toLowerCase();
    const codeStr = String(code).trim();

    console.log(`🔑 Verify OTP: email=${normalizedEmail}, code=${codeStr}, hasToken=${!!token}`);

    // ── Method 1: HMAC token (preferred) ─────────────────────────────
    if (token && timestamp) {
        const ts = Number(timestamp);
        const elapsed = Date.now() - ts;

        if (elapsed > 10 * 60 * 1000) {
            console.log(`❌ Token expired (${Math.round(elapsed / 1000)}s)`);
            return false;
        }

        const expectedToken = createToken(normalizedEmail, codeStr, ts);
        const isValid = token === expectedToken;

        if (isValid) {
            console.log(`✅ OTP verified (HMAC)`);
            otps.delete(normalizedEmail);
            return true;
        }
        console.log(`❌ HMAC mismatch`);
    }

    // ── Method 2: In-memory fallback ─────────────────────────────────
    const record = otps.get(normalizedEmail);
    if (!record) {
        console.log(`❌ No in-memory record for ${normalizedEmail}`);
        return false;
    }

    if (Date.now() > record.expiry) {
        console.log(`❌ In-memory OTP expired`);
        otps.delete(normalizedEmail);
        return false;
    }

    if (String(record.code) === codeStr) {
        console.log(`✅ OTP verified (in-memory)`);
        otps.delete(normalizedEmail);
        return true;
    }

    console.log(`❌ Code mismatch. Expected ${record.code}, got ${codeStr}`);
    return false;
}

module.exports = {
    generateOTP: generateOTPForEmail,
    verifyOTP
};
