const nodemailer = require("nodemailer");

// Render/free hosting often blocks outbound SMTP (587/465) → use HTTPS email provider in production.
function getSendStrategy() {
  if (process.env.NODE_ENV === "production" && process.env.RESEND_API_KEY) return "resend";
  return "smtp";
}

function createSmtpTransporter() {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // STARTTLS
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
    family: 4,
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 30_000,
  });
}

async function sendViaResend(email, otp) {
  const { Resend } = require("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);

  return await resend.emails.send({
    from: process.env.RESEND_FROM || "SkillBridge <onboarding@resend.dev>",
    to: email,
    subject: "Your OTP Code",
    html: `
      <h2>SkillBridge Verification</h2>
      <h1>${otp}</h1>
      <p>Valid for 10 minutes</p>
    `,
  });
}

exports.sendOTPEmail = async (email, otp) => {
  console.log("📨 Sending OTP to:", email);
  const strategy = getSendStrategy();

  try {
    if (strategy === "resend") {
      const info = await sendViaResend(email, otp);
      console.log("✅ Email sent (Resend):", info?.id || info);
      return;
    }

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      throw new Error("Missing EMAIL_USER or EMAIL_PASS environment variables");
    }

    const transporter = createSmtpTransporter();
    const info = await transporter.sendMail({
      from: `"SkillBridge" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your OTP Code",
      html: `
        <h2>SkillBridge Verification</h2>
        <h1>${otp}</h1>
        <p>Valid for 10 minutes</p>
      `,
    });

    console.log("✅ Email sent (SMTP):", info.response || info.messageId);
  } catch (err) {
    console.error("❌ EMAIL FAILED FULL ERROR:", err);
    throw err;
  }
};
