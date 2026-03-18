const nodemailer = require("nodemailer")

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
})

exports.sendOTPEmail = async (email, otp) => {
  try {

    console.log("📨 Attempting to send OTP to:", email)

    await transporter.verify()
    console.log("✅ SMTP connection verified")

    const info = await transporter.sendMail({
      from: `"SkillBridge" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your OTP Code",
      html: `
        <h2>SkillBridge Verification</h2>
        <h1>${otp}</h1>
        <p>Valid for 10 minutes</p>
      `
    })

    console.log("✅ Email sent:", info.messageId)

  } catch (err) {

    console.error("❌ EMAIL FAILED:", err.message)

    // 🔥 CRITICAL FALLBACK
    console.log("⚠️ OTP FALLBACK (use this manually):", otp)

    throw err
  }
}
