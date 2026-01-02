import nodemailer from 'nodemailer';

// Kiểm tra biến môi trường email
if (!process.env.EMAIL || !process.env.EMAIL_PASS) {
  console.error('❌ ERROR: EMAIL or EMAIL_PASS environment variables are not set!');
  console.error('Please set EMAIL and EMAIL_PASS in your .env file on Render');
}

// Configure the SMTP transporter
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com', // e.g., 'smtp.gmail.com' for Gmail
  port: 465, // or 465 for secure
  secure: true, // true for port 465, false for other ports
  auth: {
    user: process.env.EMAIL, // your SMTP username
    pass: process.env.EMAIL_PASS,    // your SMTP password (App Password)
  },
});

// Verify transporter configuration
transporter.verify(function (error, success) {
  if (error) {
    console.error('❌ Email transporter verification failed:', error);
  } else {
    console.log('✅ Email server is ready to send messages');
  }
});

// Function to send email
async function sendEmail(to, subject, text, html) {
  try {
   
    const info = await transporter.sendMail({
      from: process.env.EMAIL, // sender address
      to, // list of receivers
      subject, // Subject line
      text, // plain text body
      html, // html body
    });
    console.log('✅ Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending email:', error);
    return { success: false, error: error.message };
  }
}

export {sendEmail};