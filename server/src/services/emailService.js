/**
 * Email Service
 * -------------
 * Sends OTP emails using two providers:
 *   1. Resend API (Primary - very fast, HTTP-based, reliable on cloud)
 *   2. Gmail SMTP (Fallback - may be blocked or slow on some cloud providers)
 */

const nodemailer = require("nodemailer");

// ── Gmail SMTP transporter ─────────────────────────────────────────────────
// We use short timeouts (10s) to prevent the application from hanging 
// if the cloud provider blocks SMTP ports.
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  // Strict timeouts for cloud environments
  connectionTimeout: 10000, 
  greetingTimeout: 10000,
  socketTimeout: 10000
});

// ── Resend helper ───────────────────────────────────────────────────────────
async function sendViaResend(to, subject, text, html) {
  const from = process.env.RESEND_FROM || "SkillBridge <onboarding@resend.dev>";
  console.log("[Resend] Attempting send to:", to);

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
    throw new Error("Resend API " + res.status + ": " + body);
  }

  const data = await res.json();
  console.log("[Resend] SUCCESS! ID:", data.id);
  return data;
}

// ── Connection verification (called on startup) ──────────────────────────────
async function verifyConnection() {
  let resendReady = !!process.env.RESEND_API_KEY;
  let smtpReady = false;

  console.log("\n📧 Email Service Check:");
  console.log("   - Resend API:", resendReady ? "✅ Configured" : "⚠️ NOT CONFIGURED");

  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    try {
      // Use a short timeout for startup check
      await Promise.race([
        transporter.verify(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000))
      ]);
      console.log("   - Gmail SMTP: ✅ Verified");
      smtpReady = true;
    } catch (err) {
      console.log("   - Gmail SMTP: ❌ Skip (" + err.message + ")");
    }
  } else {
    console.log("   - Gmail SMTP: ⚠️ NOT CONFIGURED");
  }

  return resendReady || smtpReady;
}

function buildOTPEmail(code) {
  return {
    subject: "Your SkillBridge Verification Code",
    text: "Your verification code is: " + code + ". It will expire in 10 minutes.",
    html: '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #e0e0e0;border-radius:10px">'
      + '<h2 style="color:#2D3748;text-align:center">Email Verification</h2>'
      + '<p style="font-size:16px;color:#4A5568">Your OTP code is:</p>'
      + '<div style="background:#F7FAFC;padding:20px;border-radius:8px;text-align:center;margin:20px 0">'
      + '<span style="font-size:32px;font-weight:bold;letter-spacing:5px;color:#3182CE">' + code + '</span>'
      + '</div>'
      + '<p style="font-size:14px;color:#718096;text-align:center">This code will expire in 10 minutes.</p>'
      + '</div>'
  };
}

// ── Send OTP Email ──────────────────────────────────────────────────────────
// STRATEGY: 
// 1. Try Resend FIRST (fastest, most reliable on cloud)
// 2. Fallback to Gmail SMTP ONLY if Resend fails or isn't configured.
const sendOTPEmail = async (email, code) => {
  console.log("\n📨 Sending OTP to:", email);
  const { subject, text, html } = buildOTPEmail(code);

  // 1. Try Resend (Fast HTTP API)
  if (process.env.RESEND_API_KEY) {
    try {
      await sendViaResend(email, subject, text, html);
      return;
    } catch (err) {
      console.error("[Resend] FAILED:", err.message);
      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        console.log("   Falling back to Gmail SMTP...");
      }
    }
  }

  // 2. Fallback to Gmail SMTP (Traditional SMTP)
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    try {
      console.log("[SMTP] Attempting send...");
      const info = await transporter.sendMail({
        from: '"SkillBridge" <' + process.env.EMAIL_USER + '>',
        to: email,
        subject,
        text,
        html
      });
      console.log("[SMTP] SUCCESS!", info.response);
      return;
    } catch (err) {
      console.error("[SMTP] FAILED:", err.message);
      throw err;
    }
  }

  throw new Error("No email provider configured or all failed");
};

module.exports = {
  sendOTP: sendOTPEmail,
  sendOTPEmail,
  verifyConnection
};
