import nodemailer from "nodemailer";
const port = Number(process.env.SMTP_PORT);
const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port,
  secure: port === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  }
});

export default mailer;
