/**
 * Email Service - FIXED FOR GMAIL
 * ---------------------------------
 * Sends OTP emails using multiple providers:
 *   1. Brevo (primary - works on Render, any recipient)
 *   2. Resend (secondary - API based)
 *   2. Gmail SMTP (using App Password - works for all recipients)
 */

var nodemailer = require("nodemailer");

// Debug logging
console.log("");
console.log("=== EMAIL SERVICE CONFIG ===");
console.log("BREVO_API_KEY:", process.env.BREVO_API_KEY ? "SET" : "NOT SET");
console.log("RESEND_API_KEY:", process.env.RESEND_API_KEY ? "SET" : "NOT SET");
console.log("EMAIL_USER:", process.env.EMAIL_USER || "NOT SET");
console.log("EMAIL_PASS:", process.env.EMAIL_PASS ? "SET" : "NOT SET");
console.log("BREVO_SENDER_EMAIL:", process.env.BREVO_SENDER_EMAIL || "NOT SET");
console.log("RESEND_FROM:", process.env.RESEND_FROM || "NOT SET");
console.log("============================");
console.log("");

// Gmail SMTP transporter with App Password
var transporter = null;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS.replace(/\s/g, '') // Remove spaces from app password
        }
    });
}

// ── Provider 1: Brevo HTTP API ──
async function sendViaBrevo(to, subject, text, html) {
    console.log("[Brevo] Sending to", to);
    var senderEmail =
        process.env.BREVO_SENDER_EMAIL ||
        process.env.EMAIL_USER ||
        "skilltoworkbridge@gmail.com";
    var senderName = process.env.BREVO_SENDER_NAME || "SkillBridge";

    var res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
            "api-key": process.env.BREVO_API_KEY,
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        body: JSON.stringify({
            sender: { name: senderName, email: senderEmail },
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
    console.log("[Brevo] ✅ Email sent! MessageId:", data.messageId);
    return data;
}

// ── Provider 2: Resend HTTP API ──
async function sendViaResend(to, subject, text, html) {
    console.log("[Resend] Sending to", to);

    var from =
        process.env.RESEND_FROM ||
        (process.env.EMAIL_USER ? `SkillBridge <${process.env.EMAIL_USER}>` : "SkillBridge <onboarding@resend.dev>");

    var res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        body: JSON.stringify({
            from: from,
            to: [to],
            subject: subject,
            text: text,
            html: html
        })
    });

    if (!res.ok) {
        var body = await res.text();
        console.error("[Resend] API error", res.status, body);
        throw new Error("Resend API " + res.status + ": " + body);
    }

    var data = await res.json();
    console.log("[Resend] ✅ Email sent! id:", data.id);
    return data;
}

// ── Provider 2: Gmail SMTP ──
async function sendViaGmail(to, subject, text, html) {
    if (!transporter) {
        throw new Error("Gmail SMTP not configured");
    }

    console.log("[Gmail] Sending to", to);
    
    var info = await transporter.sendMail({
        from: '"SkillBridge" <' + process.env.EMAIL_USER + '>',
        to: to,
        subject: subject,
        text: text,
        html: html
    });
    
    console.log("[Gmail] ✅ Email sent! MessageID:", info.messageId);
    return info;
}

// ── Connection Verification ──
async function verifyConnection() {
    var anyAvailable = false;

    if (process.env.BREVO_API_KEY) {
        console.log("[Email] ✅ Brevo API key configured (primary)");
        anyAvailable = true;
    }
    
    if (process.env.RESEND_API_KEY) {
        console.log("[Email] ✅ Resend API key configured (secondary)");
        anyAvailable = true;
    }

    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        try {
            await transporter.verify();
            console.log("[Email] ✅ Gmail SMTP verified (fallback)");
            anyAvailable = true;
        } catch (err) {
            console.error("[Email] ❌ Gmail SMTP failed:", err.message);
            console.error("[Email]    Make sure you're using an App Password, not your regular password!");
            console.error("[Email]    Go to: https://myaccount.google.com/apppasswords");
        }
    }
    
    if (!anyAvailable) {
        console.warn("[Email] ⚠️ NO providers configured! OTPs only in server logs.");
    }
    
    return anyAvailable;
}

// ── Build OTP Email HTML ──
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

// ── Send OTP Email ──
var sendOTPEmail = async function(email, code) {
    console.log("");
    console.log("=== SENDING OTP EMAIL ===");
    console.log("To:", email);
    console.log("Code:", code);
    console.log(
        "From:",
        process.env.BREVO_SENDER_EMAIL ||
        process.env.RESEND_FROM ||
        process.env.EMAIL_USER ||
        "skilltoworkbridge@gmail.com"
    );

    var content = buildOTPEmail(code);

    // 1. Try Brevo first (works on Render, any recipient)
    if (process.env.BREVO_API_KEY) {
        try {
            await sendViaBrevo(email, content.subject, content.text, content.html);
            console.log("=========================");
            return;
        } catch (err) {
            console.error("[Brevo] Failed:", err.message);
        }
    }

    // 2. Try Resend API (works on most hosts; requires configured "from" domain)
    if (process.env.RESEND_API_KEY) {
        try {
            await sendViaResend(email, content.subject, content.text, content.html);
            console.log("=========================");
            return;
        } catch (err) {
            console.error("[Resend] Failed:", err.message);
        }
    }

    // 3. Try Gmail SMTP (works for all recipients if App Password is correct)
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        try {
            await sendViaGmail(email, content.subject, content.text, content.html);
            console.log("=========================");
            return;
        } catch (err) {
            console.error("[Gmail] Failed:", err.message);
        }
    }

    console.error("[Email] ❌ ALL PROVIDERS FAILED for", email);
    console.log("=========================");
    throw new Error("All email providers failed");
};

module.exports = {
    sendOTP: sendOTPEmail,
    sendOTPEmail: sendOTPEmail,
    verifyConnection: verifyConnection
};
