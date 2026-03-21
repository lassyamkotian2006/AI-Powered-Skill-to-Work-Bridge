/**\r
 * Email Service\r
 * -------------\r
 * Centralized email sending with dual-provider support:\r
 *   1. Gmail SMTP via Nodemailer (primary — works for all recipients)\r
 *   2. Resend API (fallback — free tier only sends to account owner)\r
 *\r
 * Common Gmail SMTP issues on deployed servers (Render, Heroku, etc.):\r
 *   - Environment variables not loaded → transporter has undefined credentials\r
 *   - IPv6 resolution fails on cloud → use family:4 to force IPv4\r
 *   - Gmail blocks "less secure apps" → must use App Passwords (2FA required)\r
 *   - Connection timeouts on cold start → increase greetingTimeout / socketTimeout\r
 *   - Port 465 needs secure:true, port 587 needs secure:false (STARTTLS)\r
 */\r
\r
const nodemailer = require("nodemailer");\r
\r
// ── Debug: log email config on startup ─────────────────────────────────────\r
console.log('\\n📧 Email Service Initializing...');\r
console.log(`   EMAIL_USER: ${process.env.EMAIL_USER ? process.env.EMAIL_USER : '❌ NOT SET'}`);\r
console.log(`   EMAIL_PASS: ${process.env.EMAIL_PASS ? '✅ SET (' + process.env.EMAIL_PASS.length + ' chars)' : '❌ NOT SET'}`);\r
console.log(`   SMTP_HOST:  ${process.env.SMTP_HOST || 'smtp.gmail.com (default)'}`);\r
console.log(`   SMTP_PORT:  ${process.env.SMTP_PORT || '587 (default)'}`);\r
console.log(`   RESEND_API_KEY: ${process.env.RESEND_API_KEY ? '✅ SET' : '⚠️  NOT SET (optional)'}`);\r
console.log('');\r
\r
// ── SMTP transporter ────────────────────────────────────────────────────────\r
// Key fixes for Render/cloud deployment:\r
//   - family: 4          → force IPv4 (IPv6 often fails on cloud platforms)\r
//   - pool: true         → reuse connections instead of opening new ones each time\r
//   - greetingTimeout    → wait longer for SMTP server greeting on cold starts\r
//   - socketTimeout      → don't timeout too early on slow cloud networks\r
//   - connectionTimeout  → give TCP connection more time on cloud\r
const smtpPort = parseInt(process.env.SMTP_PORT) || 587;\r
const transporter = nodemailer.createTransport({\r
  host: process.env.SMTP_HOST || "smtp.gmail.com",\r
  port: smtpPort,\r
  secure: smtpPort === 465,       // true for 465 (SSL), false for 587 (STARTTLS)\r
  auth: {\r
    user: process.env.EMAIL_USER,\r
    pass: process.env.EMAIL_PASS\r
  },\r
  family: 4,                      // Force IPv4 — critical for Render\r
  pool: true,                     // Connection pooling for faster sends\r
  maxConnections: 3,\r
  greetingTimeout: 30000,         // 30s — cloud cold starts can be slow\r
  socketTimeout: 60000,           // 60s — prevent premature timeout\r
  connectionTimeout: 30000,       // 30s — TCP connect timeout\r
  logger: process.env.NODE_ENV !== 'production',  // Enable SMTP debug logs in dev\r
  debug: process.env.NODE_ENV !== 'production'\r
});\r
\r
// ── Resend helper ───────────────────────────────────────────────────────────\r
/**\r
 * Send an email via the Resend HTTP API.\r
 * Uses native fetch (Node 18+).\r
 *\r
 * IMPORTANT: On Resend's free tier you can ONLY send to the account\r
 * owner's email. To send to ANY address, verify a custom domain at:\r
 * https://resend.com/domains\r
 */\r
async function sendViaResend({ to, subject, text, html }) {\r
  const from = process.env.RESEND_FROM || "SkillBridge <onboarding@resend.dev>";\r
  console.log(`📤 Resend: sending from "${from}" to "${to}"`);\r
\r
  const res = await fetch("https://api.resend.com/emails", {\r
    method: "POST",\r
    headers: {\r
      "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,\r
      "Content-Type": "application/json"\r
    },\r
    body: JSON.stringify({\r
      from,\r
      to: [to],\r
      subject,\r
      text,\r
      html\r
    })\r
  });\r
\r
  if (!res.ok) {\r
    const body = await res.text();\r
    console.error(`❌ Resend API error ${res.status}:`, body);\r
    throw new Error(`Resend API ${res.status}: ${body}`);\r
  }\r
\r
  return await res.json();\r
}\r
\r
// ── Connection verification ─────────────────────────────────────────────────\r
/**\r
 * Verify which email providers are available on startup.\r
 * Call this at server start to catch config problems early.\r
 */\r
async function verifyConnection() {\r
  let anyAvailable = false;\r
\r
  // Check SMTP (primary)\r
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {\r
    try {\r
      console.log('🔄 Verifying SMTP connection to', process.env.SMTP_HOST || 'smtp.gmail.com', '...');\r
      await transporter.verify();\r
      console.log('✅ Email SMTP: Connection verified successfully (primary sender)');\r
      anyAvailable = true;\r
    } catch (err) {\r
      console.error('❌ Email SMTP: Connection verification failed!');\r
      console.error('   Error:', err.message);\r
      console.error('   Code:', err.code || 'N/A');\r
      if (err.message.includes('Invalid login')) {\r
        console.error('   💡 FIX: Make sure EMAIL_PASS is a Gmail App Password (not your account password).');\r
        console.error('      Go to: https://myaccount.google.com/apppasswords');\r
        console.error('      Requires 2-Step Verification to be enabled first.');\r
      }\r
      if (err.message.includes('ETIMEDOUT') || err.message.includes('ECONNREFUSED')) {\r
        console.error('   💡 FIX: The SMTP server is unreachable. Check SMTP_HOST and SMTP_PORT.');\r
        console.error('      If on Render, ensure outbound port 587 is not blocked.');\r
      }\r
    }\r
  } else {\r
    console.warn('⚠️  SMTP: EMAIL_USER or EMAIL_PASS not set — SMTP email disabled');\r
    if (!process.env.EMAIL_USER) console.warn('   Missing: EMAIL_USER');\r
    if (!process.env.EMAIL_PASS) console.warn('   Missing: EMAIL_PASS');\r
  }\r
\r
  // Check Resend (fallback)\r
  if (process.env.RESEND_API_KEY) {\r
    console.log('✅ Resend Email: API key configured (fallback sender)');\r
    console.log('   ⚠️  Free tier only sends to account owner email. Verify a domain for all recipients.');\r
    anyAvailable = true;\r
  }\r
\r
  if (!anyAvailable) {\r
    console.warn('⚠️  Email: No providers configured! OTPs will only be logged to console.');\r
    console.warn('   Set EMAIL_USER + EMAIL_PASS for Gmail SMTP, or RESEND_API_KEY for Resend.');\r
  }\r
\r
  return anyAvailable;\r
}\r
\r
// ── OTP email builder ───────────────────────────────────────────────────────\r
function buildOTPEmail(code) {\r
  return {\r
    subject: "Your SkillBridge Verification Code",\r
    text: `Your verification code is: ${code}. It will expire in 10 minutes.`,\r
    html: `\r
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">\r
        <h2 style="color: #2D3748; text-align: center;">Email Verification</h2>\r
        <p style="font-size: 16px; color: #4A5568;">Your OTP code is:</p>\r
        <div style="background-color: #F7FAFC; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">\r
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #3182CE;">${code}</span>\r
        </div>\r
        <p style="font-size: 14px; color: #718096; text-align: center;">This code will expire in 10 minutes.</p>\r
        <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;">\r
        <p style="font-size: 12px; color: #A0AEC0; text-align: center;">If you didn't request this code, please ignore this email.</p>\r
      </div>\r
    `\r
  };\r
}\r
\r
// ── Public: send OTP ────────────────────────────────────────────────────────\r
/**\r
 * Send an OTP verification email.\r
 * Tries Gmail SMTP first (works for all recipients), then Resend as fallback.\r
 *\r
 * @param {string} email - Recipient email address\r
 * @param {string} code  - 6-digit OTP code\r
 */\r
const sendOTPEmail = async (email, code) => {\r
  console.log(`\\n📨 sendOTPEmail called: to="${email}", code="${code}"`);\r
  console.log(`   EMAIL_USER loaded: ${!!process.env.EMAIL_USER}`);\r
  console.log(`   RESEND_API_KEY loaded: ${!!process.env.RESEND_API_KEY}`);\r
\r
  const { subject, text, html } = buildOTPEmail(code);\r
\r
  // 1️⃣  Try Gmail SMTP first (works for ALL recipients)\r
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {\r
    try {\r
      console.log(`   📤 Attempting SMTP send from ${process.env.EMAIL_USER} to ${email}...`);\r
      const info = await transporter.sendMail({\r
        from: `"SkillBridge" <${process.env.EMAIL_USER}>`,\r
        to: email,\r
        subject,\r
        text,\r
        html\r
      });\r
      console.log("   ✅ Email sent (SMTP):", info?.response || info?.messageId || info);\r
      return;\r
    } catch (err) {\r
      console.error("   ❌ SMTP FAILED:", err.message);\r
      console.error("   Error code:", err.code || 'N/A');\r
      console.error("   Full error:", JSON.stringify({ code: err.code, command: err.command, response: err.response }, null, 2));\r
      console.log('   Falling back to Resend...');\r
    }\r
  } else {\r
    console.warn('   ⚠️  SMTP skipped: EMAIL_USER or EMAIL_PASS not configured');\r
  }\r
\r
  // 2️⃣  Fall back to Resend — NOTE: free tier can only send to the account\r
  //     owner's email unless you verify a custom domain.\r
  if (process.env.RESEND_API_KEY) {\r
    try {\r
      await sendViaResend({ to: email, subject, text, html });\r
      console.log(`   📧 OTP sent via Resend to ${email}`);\r
      return;\r
    } catch (err) {\r
      console.error(`   ❌ Resend also failed for ${email}:`, err.message);\r
      throw err;\r
    }\r
  }\r
\r
  console.error('   ❌ No email provider is configured! Set EMAIL_USER+EMAIL_PASS or RESEND_API_KEY.');\r
  throw new Error('No email provider is configured');\r
};\r
\r
module.exports = {\r
  sendOTP: sendOTPEmail,\r
  sendOTPEmail,\r
  verifyConnection\r
};\r
