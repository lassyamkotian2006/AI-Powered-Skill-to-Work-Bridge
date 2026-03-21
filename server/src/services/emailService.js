/**
 * Email Service
 * -------------
 * Centralized email sending with dual-provider support:
 *   1. Gmail SMTP via Nodemailer (primary — works for all recipients)
 *   2. Resend API (fallback — free tier only sends to account owner)
 *
 * Common Gmail SMTP issues on deployed servers (Render, Heroku, etc.):
 *   - Environment variables not loaded → transporter has undefined credentials
 *   - IPv6 resolution fails on cloud → use family:4 to force IPv4
 *   - Gmail blocks "less secure apps" → must use App Passwords (2FA required)
 *   - Connection timeouts on cold start → increase greetingTimeout / socketTimeout
 *   - Port 465 needs secure:true, port 587 needs secure:false (STARTTLS)
 */

const nodemailer = require("nodemailer");

// ── Debug: log email config on startup ─────────────────────────────────────
console.log('\n📧 Email Service Initializing...');
console.log(`   EMAIL_USER: ${process.env.EMAIL_USER ? process.env.EMAIL_USER : '❌ NOT SET'}`);
console.log(`   EMAIL_PASS: ${process.env.EMAIL_PASS ? '✅ SET (' + process.env.EMAIL_PASS.length + ' chars)' : '❌ NOT SET'}`);
console.log(`   SMTP_HOST:  ${process.env.SMTP_HOST || 'smtp.gmail.com (default)'}`);
console.log(`   SMTP_PORT:  ${process.env.SMTP_PORT || '587 (default)'}`);
console.log(`   RESEND_API_KEY: ${process.env.RESEND_API_KEY ? '✅ SET' : '⚠️  NOT SET (optional)'}`);
console.log('');

// ── SMTP transporter ────────────────────────────────────────────────────────
const smtpPort = parseInt(process.env.SMTP_PORT) || 587;
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: smtpPort,
  secure: smtpPort === 465,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  family: 4,                      // Force IPv4 — critical for Render
  pool: true,                     // Connection pooling for faster sends
  maxConnections: 3,
  greetingTimeout: 30000,         // 30s
  socketTimeout: 60000,           // 60s
  connectionTimeout: 30000,       // 30s
  logger: process.env.NODE_ENV !== 'production',
  debug: process.env.NODE_ENV !== 'production'
});

// ── Resend helper ───────────────────────────────────────────────────────────
async function sendViaResend({ to, subject, text, html }) {
  const from = process.env.RESEND_FROM || "SkillBridge <onboarding@resend.dev>";
  console.log(`📤 Resend: sending from "${from}" to "${to}"`);

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
    console.error(`❌ Resend API error ${res.status}:`, body);
    throw new Error(`Resend API ${res.status}: ${body}`);
  }

  return await res.json();
}

// ── Connection verification ─────────────────────────────────────────────────
async function verifyConnection() {
  let anyAvailable = false;

  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    try {
      console.log('🔄 Verifying SMTP connection to', process.env.SMTP_HOST || 'smtp.gmail.com', '...');
      await transporter.verify();
      console.log('✅ Email SMTP: Connection verified successfully (primary sender)');
      anyAvailable = true;
    } catch (err) {
      console.error('❌ Email SMTP: Connection verification failed!');
      console.error('   Error:', err.message);
      if (err.message.includes('Invalid login')) {
        console.error('   💡 FIX: Make sure EMAIL_PASS is a Gmail App Password.');
      }
    }
  }

  if (process.env.RESEND_API_KEY) {
    console.log('✅ Resend Email: API key configured (fallback sender)');
    anyAvailable = true;
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
const sendOTPEmail = async (email, code) => {
  console.log(`\n📨 sendOTPEmail called: to="${email}", code="${code}"`);
  const { subject, text, html } = buildOTPEmail(code);

  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    try {
      console.log(`   📤 Attempting SMTP send from ${process.env.EMAIL_USER} to ${email}...`);
      const info = await transporter.sendMail({
        from: `"SkillBridge" <${process.env.EMAIL_USER}>`,
        to: email,
        subject,
        text,
        html
      });
      console.log("   ✅ Email sent (SMTP):", info?.response || info?.messageId || info);
      return;
    } catch (err) {
      console.error("   ❌ SMTP FAILED:", err.message);
      console.log('   Falling back to Resend...');
    }
  }

  if (process.env.RESEND_API_KEY) {
    try {
      await sendViaResend({ to: email, subject, text, html });
      console.log(`   📧 OTP sent via Resend to ${email}`);
      return;
    } catch (err) {
      console.error(`   ❌ Resend also failed for ${email}:`, err.message);
      throw err;
    }
  }

  throw new Error('No email provider is configured');
};

module.exports = {
  sendOTP: sendOTPEmail,
  sendOTPEmail,
  verifyConnection
};
