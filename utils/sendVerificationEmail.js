const nodemailer = require("nodemailer");

module.exports = async function sendVerificationEmail(email, code) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.APP_GMAIL, // your Gmail
      pass: process.env.APP_GMAIL_PASS // app password
    }
  });

  const mailOptions = {
    from: `"InfoPics" <${process.env.APP_GMAIL}>`,
    to: email,
    subject: "Verify your InfoPics account",
    text: `Your verification code is: ${code}`
  };

  await transporter.sendMail(mailOptions);
};
