/**
 * Email Service
 * -------------
 * Sends OTP emails using multiple providers in order:
 *   1. Brevo HTTP API  (primary — works on Render, 300 free/day, ANY recipient)
 *   2. Resend HTTP API (fallback — free tier only sends to account owner email)
 *   3. Gmail SMTP      (local dev only — Render blocks SMTP ports)
 *
 * To set up Brevo (free, takes 1 minute):
 *   1. Sign up at https://app.brevo.com/account/register
 *   2. Go to SMTP & API > API Keys > Generate a new API key
 *   3. Set BREVO_API_KEY in your Render environment variables
 */

var nodemailer = require("nodemailer");

// Debug: log config on startup
console.log("");
console.log("=== EMAIL SERVICE CONFIG ===");
console.log("BREVO_API_KEY:", process.env.BREVO_API_KEY ? "SET" : "NOT SET");
console.log("RESEND_API_KEY:", process.env.RESEND_API_KEY ? "SET" : "NOT SET");
console.log("EMAIL_USER:", process.env.EMAIL_USER || "NOT SET");
console.log("EMAIL_PASS:", process.env.EMAIL_PASS ? "SET" : "NOT SET");
console.log("============================");
console.log("");

// Gmail SMTP transporter (works locally, blocked on Render)
var transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// ── Provider 1: Brevo HTTP API ─────────────────────────────────────────────
// 300 emails/day free, works on Render, NO domain verification needed
async function sendViaBrevo(to, subject, text, html) {
  console.log("[Brevo] Sending to", to);
  var senderEmail = process.env.EMAIL_USER || "skilltoworkbridge@gmail.com";

  var res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY,
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify({
      sender: { name: "SkillBridge", email: senderEmail },
      to: [{ email: to }],
      subject: subject,
      textContent: text,
      htmlContent: html
    })
  });

  if (!res.ok) {
    var body = await res.text();
    console.error("[Brevo] API error", res.status, body);
    throw new Error("Brevo API " + res.status + ": " + body);
  }

  var data = await res.json();
  console.log("[Brevo] Email sent! MessageId:", data.messageId);
  return data;
}

// ── Provider 2: Resend HTTP API ────────────────────────────────────────────
// Free tier: only sends to account owner email unless domain is verified
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

// ── Connection verification ────────────────────────────────────────────────
async function verifyConnection() {
  var anyAvailable = false;

  if (process.env.BREVO_API_KEY) {
    console.log("[Email] Brevo API key configured (primary)");
    anyAvailable = true;
  }
  if (process.env.RESEND_API_KEY) {
    console.log("[Email] Resend API key configured (fallback)");
    anyAvailable = true;
  }
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    try {
      await transporter.verify();
      console.log("[Email] Gmail SMTP verified (local dev fallback)");
      anyAvailable = true;
    } catch (err) {
      console.error("[Email] Gmail SMTP failed:", err.message);
    }
  }
  if (!anyAvailable) {
    console.warn("[Email] NO providers configured! OTPs only in server logs.");
  }
  return anyAvailable;
}

// ── Build OTP email ────────────────────────────────────────────────────────
function buildOTPEmail(code) {
  return {
    subject: "Your SkillBridge Verification Code",
    text: "Your verification code is: " + code + ". It expires in 10 minutes.",
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
  console.log("=== SENDING OTP EMAIL ===");
  console.log("To:", email);
  console.log("Code:", code);

  var content = buildOTPEmail(code);

  // 1. Brevo HTTP API (works on Render, any recipient)
  if (process.env.BREVO_API_KEY) {
    try {
      await sendViaBrevo(email, content.subject, content.text, content.html);
      console.log("=========================");
      return;
    } catch (err) {
      console.error("[Brevo] Failed:", err.message);
    }
  }

  // 2. Resend HTTP API (works on Render, but free tier limits recipients)
  if (process.env.RESEND_API_KEY) {
    try {
      await sendViaResend(email, content.subject, content.text, content.html);
      console.log("=========================");
      return;
    } catch (err) {
      console.error("[Resend] Failed:", err.message);
    }
  }

  // 3. Gmail SMTP (works locally, blocked on Render)
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    try {
      console.log("[SMTP] Sending via Gmail...");
      var info = await transporter.sendMail({
        from: '"SkillBridge" <' + process.env.EMAIL_USER + '>',
        to: email,
        subject: content.subject,
        text: content.text,
        html: content.html
      });
      console.log("[SMTP] Sent!", info.response);
      console.log("=========================");
      return;
    } catch (err) {
      console.error("[SMTP] Failed:", err.message);
    }
  }

  console.error("[Email] ALL PROVIDERS FAILED for", email);
  console.log("=========================");
  throw new Error("All email providers failed");
};

module.exports = {
  sendOTP: sendOTPEmail,
  sendOTPEmail: sendOTPEmail,
  verifyConnection: verifyConnection
};
