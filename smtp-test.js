import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

async function testSMTP() {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false, // must be false for Outlook
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const info = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER, // send OTP to YOURSELF for test
      subject: "SMTP TEST ✔",
      text: "SMTP is working!"
    });

    console.log("EMAIL SENT SUCCESSFULLY:", info.messageId);
  } catch (error) {
    console.log("SMTP FAILED ❌", error);
  }
}

testSMTP();
