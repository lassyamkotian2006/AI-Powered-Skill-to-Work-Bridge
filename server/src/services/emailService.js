/**
 * Email Service
 * -------------
 * Sends OTP emails using Gmail SMTP (via Nodemailer).
 * Falls back to Resend API if SMTP fails.
 *
 * Gmail SMTP requirements:
 *   1. Enable 2-Step Verification on your Google account
 *   2. Generate an App Password at https://myaccount.google.com/apppasswords
 *   3. Set EMAIL_USER = your Gmail address
 *   4. Set EMAIL_PASS = the 16-character App Password (no spaces)
 */

const nodemailer = require("nodemailer");

// ── Debug env vars on startup ──────────────────────────────────────────────
console.log("");
console.log("=== EMAIL SERVICE CONFIG ===");
console.log("EMAIL_USER:", process.env.EMAIL_USER || "NOT SET");
console.log("EMAIL_PASS:", process.env.EMAIL_PASS ? "SET (" + process.env.EMAIL_PASS.length + " chars)" : "NOT SET");
console.log("RESEND_API_KEY:", process.env.RESEND_API_KEY ? "SET" : "NOT SET");
console.log("============================");
console.log("");

// ── Gmail SMTP transporter ─────────────────────────────────────────────────
// Using service: 'gmail' is the RECOMMENDED approach.
// It auto-configures host, port, and TLS settings correctly.
// This is more reliable than manual host/port config on cloud platforms.
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// ── Resend helper (fallback) ───────────────────────────────────────────────
async function sendViaResend(to, subject, text, html) {
  var from = process.env.RESEND_FROM || "SkillBridge <onboarding@resend.dev>";
  console.log("[Resend] Sending from", from, "to", to);

  var res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + process.env.RESEND_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ from: from, to: [to], subject: subject, text: text, html: html })
  });

  if (!res.ok) {
    var body = await res.text();
    console.error("[Resend] API error", res.status, body);
    throw new Error("Resend API " + res.status + ": " + body);
  }

  var data = await res.json();
  console.log("[Resend] Email sent! ID:", data.id);
  return data;
}

// ── Verify SMTP on startup ─────────────────────────────────────────────────
async function verifyConnection() {
  var anyAvailable = false;

  // Test Gmail SMTP
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    try {
      console.log("[SMTP] Verifying Gmail connection...");
      await transporter.verify();
      console.log("[SMTP] Gmail connection VERIFIED - ready to send emails");
      anyAvailable = true;
    } catch (err) {
      console.error("[SMTP] Gmail verification FAILED:", err.message);
      console.error("[SMTP] Error code:", err.code);
      if (err.message.includes("Invalid login") || err.code === "EAUTH") {
        console.error("[SMTP] FIX: Your EMAIL_PASS must be a Gmail App Password, NOT your Google password.");
        console.error("[SMTP] Generate one at: https://myaccount.google.com/apppasswords");
        console.error("[SMTP] Make sure EMAIL_PASS has no spaces (should be 16 characters).");
      }
      if (err.code === "ESOCKET" || err.code === "ETIMEDOUT" || err.code === "ECONNREFUSED") {
        console.error("[SMTP] FIX: SMTP connection blocked. This can happen on some cloud platforms.");
      }
    }
  } else {
    console.warn("[SMTP] Skipped - EMAIL_USER or EMAIL_PASS not set");
  }

  // Check Resend
  if (process.env.RESEND_API_KEY) {
    console.log("[Resend] API key configured (fallback)");
    anyAvailable = true;
  }

  if (!anyAvailable) {
    console.warn("[Email] NO providers available! OTPs will only be in server logs.");
  }

  return anyAvailable;
}

// ── Build OTP email HTML ───────────────────────────────────────────────────
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
      + '<hr style="border:0;border-top:1px solid #e0e0e0;margin:20px 0">'
      + '<p style="font-size:12px;color:#A0AEC0;text-align:center">If you did not request this code, please ignore this email.</p>'
      + '</div>'
  };
}

// ── Send OTP Email ─────────────────────────────────────────────────────────
var sendOTPEmail = async function(email, code) {
  console.log("");
  console.log("========== SENDING OTP EMAIL ==========");
  console.log("To:", email);
  console.log("Code:", code);
  console.log("EMAIL_USER loaded:", !!process.env.EMAIL_USER);
  console.log("EMAIL_PASS loaded:", !!process.env.EMAIL_PASS);
  console.log("RESEND_API_KEY loaded:", !!process.env.RESEND_API_KEY);

  var emailContent = buildOTPEmail(code);

  // 1. Try Gmail SMTP first
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    try {
      // Verify connection before sending
      console.log("[SMTP] Verifying connection before send...");
      await transporter.verify();
      console.log("[SMTP] Connection OK, sending email...");

      var mailOptions = {
        from: '"SkillBridge" <' + process.env.EMAIL_USER + '>',
        to: email,
        subject: emailContent.subject,
        text: emailContent.text,
        html: emailContent.html
      };

      var info = await transporter.sendMail(mailOptions);
      console.log("[SMTP] EMAIL SENT SUCCESSFULLY!");
      console.log("[SMTP] Response:", info.response);
      console.log("[SMTP] MessageId:", info.messageId);
      console.log("========================================");
      return;
    } catch (err) {
      console.error("[SMTP] SEND FAILED!");
      console.error("[SMTP] Error:", err.message);
      console.error("[SMTP] Code:", err.code);
      if (err.response) console.error("[SMTP] Server response:", err.response);
      console.log("[SMTP] Will try Resend as fallback...");
    }
  } else {
    console.warn("[SMTP] Skipped - credentials not configured");
  }

  // 2. Fallback to Resend API
  if (process.env.RESEND_API_KEY) {
    try {
      await sendViaResend(email, emailContent.subject, emailContent.text, emailContent.html);
      console.log("========================================");
      return;
    } catch (err) {
      console.error("[Resend] SEND FAILED:", err.message);
    }
  }

  console.error("[Email] ALL PROVIDERS FAILED - no email sent to", email);
  console.log("========================================");
  throw new Error("All email providers failed");
};

module.exports = {
  sendOTP: sendOTPEmail,
  sendOTPEmail: sendOTPEmail,
  verifyConnection: verifyConnection
};
