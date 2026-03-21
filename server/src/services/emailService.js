/**
 * Email Service
 * -------------
 * Centralized email sending with dual-provider support:
 *   1. Resend API (primary on cloud — reliable HTTP-based, no port issues)
 *   2. Gmail SMTP via Nodemailer (fallback — may silently fail on cloud)
 *
 * NOTE: On Resend free tier, emails can only be sent to the account owner
 * unless you verify a custom domain at https://resend.com/domains
 */

const nodemailer = require("nodemailer");

// Debug: log email config on startup
console.log('\n📧 Email Service Initializing...');
console.log('   EMAIL_USER:', process.env.EMAIL_USER || '❌ NOT SET');
console.log('   EMAIL_PASS:', process.env.EMAIL_PASS ? '✅ SET' : '❌ NOT SET');
console.log('   RESEND_API_KEY:', process.env.RESEND_API_KEY ? '✅ SET' : '⚠️ NOT SET');
console.log('');

// SMTP transporter (fallback)
const smtpPort = parseInt(process.env.SMTP_PORT) || 587;
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: smtpPort,
  secure: smtpPort === 465,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  family: 4,
  pool: true,
  maxConnections: 3,
  greetingTimeout: 30000,
  socketTimeout: 60000,
  connectionTimeout: 30000
});

// Resend helper (HTTP-based — works reliably on cloud platforms)
async function sendViaResend({ to, subject, text, html }) {
  const from = process.env.RESEND_FROM || "SkillBridge <onboarding@resend.dev>";
  console.log('   📤 Resend: from "' + from + '" to "' + to + '"');

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + process.env.RESEND_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ from, to: [to], subject, text, html })
  });

  if (!res.ok) {
    const body = await res.text();
    console.error('   ❌ Resend API error ' + res.status + ':', body);
    throw new Error('Resend API ' + res.status + ': ' + body);
  }

  const data = await res.json();
  console.log('   ✅ Email sent via Resend! ID:', data.id);
  return data;
}

// Connection verification (called on startup)
async function verifyConnection() {
  let anyAvailable = false;

  if (process.env.RESEND_API_KEY) {
    console.log('✅ Resend Email: API key configured (primary sender)');
    anyAvailable = true;
  }

  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    try {
      await transporter.verify();
      console.log('✅ Email SMTP: Connection verified (fallback sender)');
      anyAvailable = true;
    } catch (err) {
      console.error('❌ Email SMTP: Verification failed:', err.message);
    }
  }

  if (!anyAvailable) {
    console.warn('⚠️ No email providers configured. OTPs will only be logged to console.');
  }

  return anyAvailable;
}

// OTP email builder
function buildOTPEmail(code) {
  return {
    subject: "Your SkillBridge Verification Code",
    text: "Your verification code is: " + code + ". It will expire in 10 minutes.",
    html: '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">'
      + '<h2 style="color: #2D3748; text-align: center;">Email Verification</h2>'
      + '<p style="font-size: 16px; color: #4A5568;">Your OTP code is:</p>'
      + '<div style="background-color: #F7FAFC; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">'
      + '<span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #3182CE;">' + code + '</span>'
      + '</div>'
      + '<p style="font-size: 14px; color: #718096; text-align: center;">This code will expire in 10 minutes.</p>'
      + '<hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;">'
      + '<p style="font-size: 12px; color: #A0AEC0; text-align: center;">If you didn\'t request this code, please ignore this email.</p>'
      + '</div>'
  };
}

// Public: send OTP email
// Tries Resend FIRST (HTTP API — reliable on cloud), then SMTP as fallback
const sendOTPEmail = async (email, code) => {
  console.log('\n📨 sendOTPEmail: to="' + email + '", code="' + code + '"');
  const { subject, text, html } = buildOTPEmail(code);

  // 1. Try Resend first (HTTP API — no port/firewall issues on cloud)
  if (process.env.RESEND_API_KEY) {
    try {
      await sendViaResend({ to: email, subject, text, html });
      return;
    } catch (err) {
      console.error('   ❌ Resend failed:', err.message);
      console.log('   Falling back to SMTP...');
    }
  }

  // 2. Fallback to Gmail SMTP
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    try {
      console.log('   📤 Attempting SMTP send to ' + email + '...');
      const info = await transporter.sendMail({
        from: '"SkillBridge" <' + process.env.EMAIL_USER + '>',
        to: email,
        subject: subject,
        text: text,
        html: html
      });
      console.log('   ✅ Email sent (SMTP):', info.response || info.messageId);
      return;
    } catch (err) {
      console.error('   ❌ SMTP FAILED:', err.message);
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
