import mailer from "../config/mailer.js";
async function sendOtpEmail(email, code, purpose = "registration") {
  const descriptions = {
    "registration": "Welcome to Northstar!",
    "login": "Complete your Northstar sign-in.",
    "password-recovery": "Verify your email to reset your password.",
    "email-change-current": "Confirm your current email address.",
    "email-change-new": "Verify your new email address.",
    "password-change": "Confirm your password change.",
  };

  const subject = "Northstar Verification Code";
  const message = descriptions[purpose] || descriptions.registration;

  await mailer.sendMail({
    from: {
      name: "Northstar",
      address: process.env.SMTP_USER
    },
    to: email,
    subject: subject,
    text: `${message}

Your verification code is: ${code}

This code expires in 5 minutes.
Do not share this code with anyone.

If you did not request this, you can ignore this email.`,
  });
}

export default sendOtpEmail;