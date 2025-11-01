const nodemailer = require("nodemailer");

async function sendVerificationEmail(email, code, options = {}) {
  // options: { pendingId, appBaseUrl } — pendingId optional; appBaseUrl used to render a link
  const { pendingId, appBaseUrl } = options;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.APP_GMAIL,
      pass: process.env.APP_GMAIL_PASS,
    },
  });

  const subject = "Verify your InfoPics account";
  const textLines = [`Your verification code is: ${code}`, "Enter it on the InfoPics verification page to finish signup."];
  const htmlLines = [
    `<p>Your verification code is: <strong>${code}</strong></p>`,
    `<p>Enter it on the InfoPics verification page to finish signup.</p>`,
  ];

  if (pendingId && appBaseUrl) {
    const verifyUrl = `${appBaseUrl.replace(/\/$/, "")}/verify`;
    textLines.push(`If you opened this email on a different device, visit ${verifyUrl} and enter the code. Your pendingId is ${pendingId}.`);
    htmlLines.push(
      `<p>If you opened this email on a different device, <a href="${verifyUrl}">open the verification page</a> and enter the code. Your pendingId is <code>${pendingId}</code>.</p>`
    );
  } else if (appBaseUrl) {
    const verifyUrl = `${appBaseUrl.replace(/\/$/, "")}/verify`;
    textLines.push(`Open ${verifyUrl} to enter the code and finish signup.`);
    htmlLines.push(`<p>Open <a href="${verifyUrl}">${verifyUrl}</a> to enter the code and finish signup.</p>`);
  }

  const mailOptions = {
    from: `"InfoPics" <${process.env.APP_GMAIL}>`,
    to: email,
    subject,
    text: textLines.join("\n\n"),
    html: htmlLines.join(""),
  };

  const info = await transporter.sendMail(mailOptions);
  console.log(`📨 Verification email sent to ${email} (messageId: ${info.messageId})`);
  return info;
}

// Exports (support both require styles)
module.exports = sendVerificationEmail;
module.exports.sendVerificationEmail = sendVerificationEmail;
