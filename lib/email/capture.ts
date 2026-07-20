import type { EmailService, ContactCodeEmail, CreatorManageEmail } from './types'
import { contactCodeSubject, creatorManageSubject } from './template'

export interface CapturedEmail {
  to: string
  subject: string
  code: string
  unlockUrl: string
  manageUrl?: string
  sentAt: string
}

const store = globalThis as unknown as { __brocodeEmails?: CapturedEmail[] }

function emails(): CapturedEmail[] {
  if (!store.__brocodeEmails) store.__brocodeEmails = []
  return store.__brocodeEmails
}

export function getCapturedEmails(): CapturedEmail[] {
  return emails()
}

export function clearCapturedEmails(): void {
  emails().length = 0
}

export class CaptureEmailService implements EmailService {
  async sendContactCode(msg: ContactCodeEmail): Promise<{ resendEmailId: string | null }> {
    emails().push({
      to: msg.to,
      subject: contactCodeSubject(msg),
      code: msg.code,
      unlockUrl: msg.unlockUrl,
      sentAt: new Date().toISOString(),
    })
    return { resendEmailId: null }
  }

  async sendCreatorEmail(msg: CreatorManageEmail): Promise<{ resendEmailId: string | null }> {
    emails().push({
      to: msg.to,
      subject: creatorManageSubject(msg),
      code: msg.code,
      unlockUrl: msg.unlockUrl,
      manageUrl: msg.managementUrl,
      sentAt: new Date().toISOString(),
    })
    return { resendEmailId: null }
  }
}
