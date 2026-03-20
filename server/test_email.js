require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

console.log('EMAIL_USER:', process.env.EMAIL_USER);
console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? '***SET***' : 'MISSING');

async function test() {
    try {
        await transporter.verify();
        console.log('SMTP verify: OK');
    } catch (err) {
        console.error('SMTP verify FAILED:', err.message);
        return;
    }

    try {
        const info = await transporter.sendMail({
            from: '"SkillBridge" <' + process.env.EMAIL_USER + '>',
            to: process.env.EMAIL_USER,
            subject: 'SkillBridge Test OTP - 123456',
            text: 'Your test verification code is: 123456. If you received this, email sending works!',
            html: '<h2>Test OTP</h2><h1>123456</h1><p>If you received this, email sending works!</p>'
        });
        console.log('EMAIL SENT! Response:', info.response);
        console.log('MessageId:', info.messageId);
    } catch (err) {
        console.error('SEND FAILED:', err.message);
        console.error('Error code:', err.code);
        if (err.response) console.error('Server response:', err.response);
    }
}

test();
