const nodemailer = require("nodemailer")

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
})

async function sendOTP(email, code) {
    const mailOptions = {
        from: `"SkillBridge" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Your SkillBridge Verification Code",
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <h2 style="color: #2D3748; text-align: center;">Email Verification</h2>
        <p style="font-size: 16px; color: #4A5568;">Your OTP code is:</p>
        <div style="background-color: #F7FAFC; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #3182CE;">${code}</span>
        </div>
        <p style="font-size: 14px; color: #718096; text-align: center;">This code will expire in 10 minutes.</p>
        <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;">
        <p style="font-size: 12px; color: #A0AEC0; text-align: center;">If you didn't request this code, please ignore this email.</p>
      </div>
    `
    }

    await transporter.sendMail(mailOptions)
}

module.exports = { sendOTP }
