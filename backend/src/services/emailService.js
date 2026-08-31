const nodemailer = require('nodemailer');

const transportOptions = process.env.NODE_ENV === 'test'
  ? { jsonTransport: true }
  : {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    };

const transporter = nodemailer.createTransport(transportOptions);

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const sendVerificationEmail = async (email, token) => {
  const verifyUrl = `${process.env.CLIENT_URL}/verify-email/${token}`;
  
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'Verify your Fixly account',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0284c7;">Welcome to Fixly!</h2>
          <p>Click the button below to verify your email address:</p>
          <a href="${verifyUrl}" style="display:inline-block;background:#0284c7;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;margin:16px 0;">Verify Email</a>
          <p>Or copy this link: <a href="${verifyUrl}">${verifyUrl}</a></p>
          <p style="color:#666;font-size:12px;">This link expires in 24 hours.</p>
        </div>
      `,
    });
  } catch (err) {
    console.error('Email send failed:', err.message);
  }
};

const sendPasswordResetEmail = async (email, token) => {
  const resetUrl = `${process.env.CLIENT_URL}/reset-password/${token}`;
  
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'Reset your Fixly password',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0284c7;">Password Reset</h2>
          <p>Click below to reset your password:</p>
          <a href="${resetUrl}" style="display:inline-block;background:#0284c7;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;margin:16px 0;">Reset Password</a>
          <p style="color:#666;font-size:12px;">This link expires in 1 hour.</p>
          <p>If you didn't request this, ignore this email.</p>
        </div>
      `,
    });
  } catch (err) {
    console.error('Email send failed:', err.message);
  }
};

const sendContactEmail = async ({ name, email, topic, message }) => {
  const recipient = process.env.CONTACT_RECIPIENT_EMAIL;
  if (!recipient) throw new Error('Contact recipient is not configured');

  return transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: recipient,
    replyTo: email,
    subject: `[Fixly contact] ${topic}`,
    text: `Name: ${name}\nEmail: ${email}\nTopic: ${topic}\n\n${message}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#0f172a">
        <h2 style="color:#0284c7">New Fixly contact message</h2>
        <p><strong>From:</strong> ${escapeHtml(name)} (${escapeHtml(email)})</p>
        <p><strong>Topic:</strong> ${escapeHtml(topic)}</p>
        <div style="margin-top:20px;padding:16px;background:#f8fafc;border-radius:8px;white-space:pre-wrap">${escapeHtml(message)}</div>
      </div>
    `,
  });
};

module.exports = { sendVerificationEmail, sendPasswordResetEmail, sendContactEmail };
