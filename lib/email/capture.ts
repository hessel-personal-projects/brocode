import type { EmailService, ContactCodeEmail } from './types'
import { contactCodeSubject } from './template'

export interface CapturedEmail {
  to: string
  subject: string
  code: string
  unlockUrl: string
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
  async sendContactCode(msg: ContactCodeEmail): Promise<void> {
    emails().push({
      to: msg.to,
      subject: contactCodeSubject(msg),
      code: msg.code,
      unlockUrl: msg.unlockUrl,
      sentAt: new Date().toISOString(),
    })
  }
}
