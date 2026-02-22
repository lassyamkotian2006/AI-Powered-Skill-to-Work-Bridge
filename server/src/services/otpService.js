/**
 * OTP Service
 * -----------
 * Handles generation, storage, and verification of One-Time Passwords.
 * For this bridge, we use an in-memory store for simplicity, but codes 
 * expire after 5 minutes.
 */

const otps = new Map();

/**
 * Generate a 6-digit OTP for a given email
 */
function generateOTP(email) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = Date.now() + 5 * 60 * 1000; // 5 minutes

    otps.set(email, { code, expiry });

    // In a real app, this would send an email. 
    // For now, we log it to the console for testing.
    console.log(`\n-----------------------------------------`);
    console.log(`🔐 SECURITY: OTP for ${email} is: ${code}`);
    console.log(`-----------------------------------------\n`);

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
    generateOTP,
    verifyOTP
};
