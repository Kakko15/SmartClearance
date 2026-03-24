const nodemailer = require("nodemailer");

let _transporter = null;

function getEmailTransporter() {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || "587", 10),
      secure: process.env.EMAIL_SECURE === "true",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
      pool: true,
      maxConnections: 3,
      maxMessages: 100,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  }
  return _transporter;
}

module.exports = { getEmailTransporter };
