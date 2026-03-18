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

async function sendOTPEmail(email, otp) {
  await transporter.sendMail({
    from: `"SkillBridge" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Verification Code",
    html: `
      <h2>Your OTP Code</h2>
      <h1>${otp}</h1>
      <p>Valid for 10 minutes</p>
    `
  })
}

// Backwards compatible export used elsewhere in this codebase
async function sendOTP(email, code) {
  return sendOTPEmail(email, code)
}

module.exports = { sendOTPEmail, sendOTP }
