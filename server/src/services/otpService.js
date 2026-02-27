/**
 * OTP Service
 * -----------
 * Handles generation, storage, and verification of One-Time Passwords.
 * For this bridge, we use an in-memory store for simplicity, but codes 
 * expire after 5 minutes.
 */

const otps = new Map();
const nodemailer = require('nodemailer');

// Initialize transporter
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_PORT === '465',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

/**
 * Generate a 6-digit OTP for a given email
 */
async function generateOTP(email) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = Date.now() + 5 * 60 * 1000; // 5 minutes

    otps.set(email, { code, expiry });

    // In a real app, this would send an email. 
    console.log(`\n-----------------------------------------`);
    console.log(`🔐 SECURITY: OTP for ${email} is: ${code}`);
    console.log(`-----------------------------------------\n`);

    // Send actual email if configuration exists
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        try {
            await transporter.sendMail({
                from: `"SkillBridge" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
                to: email,
                subject: "Your Verification Code - SkillBridge",
                text: `Your verification code is: ${code}. It will expire in 5 minutes.`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                        <h2 style="color: #2D3748; text-align: center;">Verification Code</h2>
                        <p style="font-size: 16px; color: #4A5568;">Use the code below to verify your identity on SkillBridge:</p>
                        <div style="background-color: #F7FAFC; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                            <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #3182CE;">${code}</span>
                        </div>
                        <p style="font-size: 14px; color: #718096; text-align: center;">This code will expire in 5 minutes.</p>
                        <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;">
                        <p style="font-size: 12px; color: #A0AEC0; text-align: center;">If you didn't request this code, please ignore this email.</p>
                    </div>
                `
            });
            console.log(`📧 Email sent successfully to ${email}`);
        } catch (error) {
            console.error(`❌ Failed to send email to ${email}:`, error.message);
        }
    }

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
