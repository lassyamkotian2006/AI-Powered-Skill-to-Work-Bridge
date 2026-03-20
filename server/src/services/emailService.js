/**
 * Email Service
 * -------------
 * Centralized email sending with dual-provider support:
 *   1. Resend API (primary)
 *   2. Nodemailer / Gmail SMTP (fallback)
 */

const nodemailer = require("nodemailer");

// ── SMTP transporter (fallback) ─────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  family: 4 // Force IPv4 to avoid some SMTP connection issues
});

// ── Resend helper ───────────────────────────────────────────────────────────
/**
 * Send an email via the Resend HTTP API.
 * Uses native fetch (Node 18+).
 */
async function sendViaResend({ to, subject, text, html }) {
  const from = process.env.RESEND_FROM || `SkillBridge <${process.env.EMAIL_USER || "skilltoworkbridge@gmail.com"}>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
      html
    })
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend API ${res.status}: ${body}`);
  }

  return await res.json();
}

// ── Connection verification ─────────────────────────────────────────────────
/**
 * Verify which email providers are available on startup (non-blocking).
 */
async function verifyConnection() {
  let anyAvailable = false;

  // Check Resend
  if (process.env.RESEND_API_KEY) {
    console.log('✅ Resend Email: API key configured (primary sender)');
    anyAvailable = true;
  }

  // Check SMTP
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    try {
      await transporter.verify();
      console.log('✅ Email SMTP: Connection verified successfully (fallback)');
      anyAvailable = true;
    } catch (err) {
      console.error('❌ Email SMTP: Connection verification failed:', err.message);
    }
  }

  if (!anyAvailable) {
    console.warn('⚠️  Email: No providers configured. OTPs will only be logged to console.');
  }

  return anyAvailable;
}

// ── OTP email builder ───────────────────────────────────────────────────────
function buildOTPEmail(code) {
  return {
    subject: "Your SkillBridge Verification Code",
    text: `Your verification code is: ${code}. It will expire in 10 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <h2 style="color: #2D3748; text-align: center;">Email Verification</h2>
        <p style="font-size: 16px; color: #4A5568;">Your OTP code is:</p>
        <div style="background-color: #F7FAFC; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #3182CE;">${code}</span>
        </div>
        <p style="font-size: 14px; color: #718096; text-align: center;">This code will expire in 10 minutes.</p>
        <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;">
        <p style="font-size: 12px; color: #A0AEC0; text-align: center;">If you didn't request this code, please ignore this email.</p>
      </div>
    `
  };
}

// ── Public: send OTP ────────────────────────────────────────────────────────
/**
 * Send an OTP verification email.
 * Tries Resend first, then falls back to SMTP.
 *
 * @param {string} email - Recipient email address
 * @param {string} code  - 6-digit OTP code
 */
const sendOTPEmail = async (email, code) => {
  console.log("📨 Sending OTP to:", email);
  const { subject, text, html } = buildOTPEmail(code);

  // 1️⃣  Try Resend (primary)
  if (process.env.RESEND_API_KEY) {
    try {
      await sendViaResend({ to: email, subject, text, html });
      console.log(`📧 OTP sent via Resend to ${email}`);
      return;
    } catch (err) {
      console.error(`❌ Resend failed for ${email}:`, err.message);
      if (process.env.NODE_ENV === "production") {
        console.log('   Retrying via SMTP (though it might fail on Render)...');
      } else {
        console.log('   Falling back to SMTP...');
      }
    }
  }

  // 2️⃣  Fall back to SMTP
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    try {
      const info = await transporter.sendMail({
        from: `"SkillBridge" <${process.env.EMAIL_USER}>`,
        to: email,
        subject,
        text,
        html
      });
      console.log("✅ Email sent (SMTP):", info?.response || info?.messageId || info);
      return;
    } catch (err) {
      console.error("❌ SMTP FAILED:", err.message);
      throw err;
    }
  }

  throw new Error('No email provider is configured');
};

module.exports = {
  sendOTP: sendOTPEmail, // Alias for backward compatibility if needed
  sendOTPEmail,          // Primary export
  verifyConnection
};
