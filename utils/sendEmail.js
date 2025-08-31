const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,                     // smtp.gmail.com
  port: Number(process.env.SMTP_PORT || 587),      // 587 for STARTTLS, 465 for SSL
  secure: Number(process.env.SMTP_PORT) === 465,   // true only for 465
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  logger: true,   // log details to console
  debug: true     // verbose SMTP logs
});

// Verify once at startup so you immediately see if auth is OK
transporter.verify((err) => {
  if (err) console.error('[SMTP VERIFY ERROR]', err.message);
  else console.log('[SMTP] Ready to send');
});

async function sendEmail({ to, subject, text, html }) {
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  const info = await transporter.sendMail({ from, to, subject, text, html });
  console.log('[SMTP SENT]', {
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
    response: info.response
  });
  return info;
}

module.exports = sendEmail;
