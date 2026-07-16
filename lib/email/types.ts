export interface ContactCodeEmail {
  to: string
  contactName: string
  code: string
  unlockUrl: string
  title?: string
}

export interface EmailService {
  sendContactCode(msg: ContactCodeEmail): Promise<void>
}
