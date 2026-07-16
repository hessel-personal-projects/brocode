import { Resend } from 'resend'
import type { EmailService, ContactCodeEmail } from './types'
import { contactCodeSubject, renderContactCodeHtml } from './template'

export class ResendEmailService implements EmailService {
  private resend: Resend

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY!)
  }

  async sendContactCode(msg: ContactCodeEmail): Promise<void> {
    const { error } = await this.resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to: msg.to,
      subject: contactCodeSubject(msg),
      html: renderContactCodeHtml(msg),
    })
    if (error) throw new Error(`Resend error: ${error.message}`)
  }
}
