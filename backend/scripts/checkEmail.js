import "dotenv/config";
import mailer from "../config/mailer.js";

try {
  await mailer.verify();
  console.log("Email server connection successful. No test email was sent.");
} catch (error) {
  console.error("Email setup failed:", error.code || error.message);
  process.exitCode = 1;
}
// checkEmail.js — Tests the SMTP email connection.