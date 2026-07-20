import type { EmailService } from './types'
import { CaptureEmailService } from './capture'
import { ResendEmailService } from './resend'

export function getEmailService(): EmailService {
  if (process.env.EMAIL_TRANSPORT === 'resend') return new ResendEmailService()
  return new CaptureEmailService()
}

export type { EmailService, ContactCodeEmail, CreatorManageEmail, EmailDeliveryStatus } from './types'
