// smtp-test.js
require('dotenv').config();
const nodemailer = require('nodemailer');
(async () => {
  const t = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    logger: true, debug: true
  });
  await t.verify();
  const info = await t.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: process.env.SMTP_USER,
    subject: 'SMTP test',
    text: 'If this arrives, Gmail SMTP works.'
  });
  console.log('Sent:', info.messageId, info.response, info.accepted, info.rejected);
})();
