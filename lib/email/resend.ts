import { Resend } from 'resend'
import type { EmailService, ContactCodeEmail, CreatorManageEmail } from './types'
import {
  contactCodeSubject,
  renderContactCodeHtml,
  creatorManageSubject,
  renderCreatorManageHtml,
} from './template'

export class ResendEmailService implements EmailService {
  private resend: Resend

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY!)
  }

  async sendContactCode(msg: ContactCodeEmail): Promise<{ resendEmailId: string | null }> {
    const { data, error } = await this.resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to: msg.to,
      subject: contactCodeSubject(msg),
      html: renderContactCodeHtml(msg),
    })
    if (error) throw new Error(`Resend error: ${error.message}`)
    return { resendEmailId: data?.id ?? null }
  }

  async sendCreatorEmail(msg: CreatorManageEmail): Promise<{ resendEmailId: string | null }> {
    const { data, error } = await this.resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to: msg.to,
      subject: creatorManageSubject(msg),
      html: renderCreatorManageHtml(msg),
    })
    if (error) throw new Error(`Resend error: ${error.message}`)
    return { resendEmailId: data?.id ?? null }
  }
}
