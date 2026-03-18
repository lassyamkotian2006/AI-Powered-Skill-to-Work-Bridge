const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // use STARTTLS
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
  family: 4, // force IPv4 to avoid IPv6 ENETUNREACH on some hosts
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
        <p>Valid for 10 minutes</p>
      `,
    });

    console.log("✅ Email sent:", info.response);
  } catch (err) {
    console.error("❌ EMAIL FAILED FULL ERROR:", err);
    throw err;
  }
};
