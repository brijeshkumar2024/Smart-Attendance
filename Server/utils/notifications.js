const nodemailer = require("nodemailer");

let transporter;

const getTransporter = () => {
  if (transporter !== undefined) {
    return transporter;
  }

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    transporter = null;
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
};

const sendLowAttendanceEmail = async ({ toEmail, name, percentage }) => {
  try {
    const mailer = getTransporter();
    if (!mailer || !toEmail) {
      return;
    }

    await mailer.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: toEmail,
      subject: "Attendance Warning",
      text: `Hello ${name || "Student"}, your attendance is ${percentage}%. Please improve it as soon as possible.`,
    });
  } catch (error) {
    console.error("Email notification failed:", error.message);
  }
};

module.exports = { sendLowAttendanceEmail };
