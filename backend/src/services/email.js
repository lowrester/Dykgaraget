import nodemailer from 'nodemailer'
import dotenv from 'dotenv'
dotenv.config()

let transporter

function getTransporter() {
  if (transporter) return transporter

  if (process.env.SENDGRID_API_KEY) {
    transporter = nodemailer.createTransport({
      host: 'smtp.sendgrid.net',
      port: 587,
      auth: { user: 'apikey', pass: process.env.SENDGRID_API_KEY }
    })
  } else {
    // Dev fallback – logs to console
    transporter = nodemailer.createTransport({
      jsonTransport: true
    })
  }
  return transporter
}

export async function sendEmail({ to, subject, html, attachments = [] }) {
  const t = getTransporter()
  const info = await t.sendMail({
    from: `${process.env.EMAIL_FROM_NAME || 'Dykgaraget'} <${process.env.EMAIL_FROM || 'noreply@dykgaraget.se'}>`,
    to, subject, html, attachments
  })
  if (process.env.NODE_ENV !== 'production') {
    console.log('📧 Email (dev):', JSON.stringify(info))
  }
  return info
}
