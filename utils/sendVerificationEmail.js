const nodemailer = require("nodemailer");

async function sendVerificationEmail(email, code) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.APP_GMAIL,
      pass: process.env.APP_GMAIL_PASS,
    },
  });

  const mailOptions = {
    from: `"InfoPics" <${process.env.APP_GMAIL}>`,
    to: email,
    subject: "Verify your InfoPics account",
    text: `Your verification code is: ${code}`,
  };

  // Let caller handle errors; still log for debugging
  const info = await transporter.sendMail(mailOptions);
  console.log(`📨 Verification email sent to ${email} (messageId: ${info.messageId})`);
  return info;
}

// Export both the function and as a named property to support either:
// const sendVerificationEmail = require(...)
// or
// const { sendVerificationEmail } = require(...)
module.exports = sendVerificationEmail;
module.exports.sendVerificationEmail = sendVerificationEmail;
