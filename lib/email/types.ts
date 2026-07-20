export type EmailDeliveryStatus = 'PENDING' | 'DELIVERED' | 'BOUNCED' | 'FAILED'

export interface ContactCodeEmail {
  to: string
  contactName: string
  code: string
  unlockUrl: string
  title?: string
}

export interface CreatorManageEmail {
  to: string
  creatorName: string
  code: string
  managementUrl: string
  unlockUrl: string
  title?: string
}

export interface EmailService {
  sendContactCode(msg: ContactCodeEmail): Promise<{ resendEmailId: string | null }>
  sendCreatorEmail(msg: CreatorManageEmail): Promise<{ resendEmailId: string | null }>
}
