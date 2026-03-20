const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // MUST be false for port 587
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  family: 4, // 🔥 FORCE IPv4 (fixes your Render error)
});

exports.sendOTPEmail = async (email, otp) => {
  try {
    console.log("📨 Sending OTP to:", email);

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

    console.log("✅ Email sent:", info.response);
  } catch (err) {
    console.error("❌ EMAIL FAILED:", err.message);
    throw err; // keep this — we want real error if it fails
  }
};
