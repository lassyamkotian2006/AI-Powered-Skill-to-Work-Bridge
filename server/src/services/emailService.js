const nodemailer = require("nodemailer");

function createSmtpTransporter() {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // STARTTLS (must be false for 587)
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    family: 4, // force IPv4
  });
}

async function sendViaResend(email, otp) {
  const { Resend } = require("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);

  const from = process.env.RESEND_FROM || `SkillBridge <${process.env.EMAIL_USER}>`;

  // Resend requires `from` to be verified/allowed in your Resend account
  return await resend.emails.send({
    from,
    to: email,
    subject: "Your OTP Code",
    html: `
      <h2>SkillBridge Verification</h2>
      <h1>${otp}</h1>
      <p>This OTP is valid for 10 minutes.</p>
    `,
  });
}

exports.sendOTPEmail = async (email, otp) => {
  console.log("📨 Sending OTP to:", email);

  try {
    if (process.env.NODE_ENV === "production") {
      if (!process.env.RESEND_API_KEY) {
        throw new Error("Production email delivery requires RESEND_API_KEY (SMTP times out on Render)");
      }

      const info = await sendViaResend(email, otp);
      console.log("✅ Email sent (Resend):", info?.id || info);
      return;
    }

    // Non-production fallback (for local development)
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
        <p>This OTP is valid for 10 minutes.</p>
      `,
    });

    console.log("✅ Email sent (SMTP):", info?.response || info?.messageId || info);
  } catch (err) {
    console.error("❌ EMAIL FAILED FULL ERROR:", err);
    throw err;
  }
};
