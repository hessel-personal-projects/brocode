import nodemailer from 'nodemailer'

export function createSesTransporter() {
  return nodemailer.createTransport({
    host: `email-smtp.${process.env.SES_REGION ?? 'us-east-1'}.amazonaws.com`,
    port: 587,
    secure: false,
    auth: {
      user: process.env.SES_SMTP_USER!,
      pass: process.env.SES_SMTP_PASSWORD!,
    },
  })
}
