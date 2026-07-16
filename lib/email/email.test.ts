import { describe, it, expect, beforeEach } from 'vitest'
import { getEmailService } from './index'
import { CaptureEmailService, getCapturedEmails, clearCapturedEmails } from './capture'
import { ResendEmailService as ResendImpl } from './resend'
import { contactCodeSubject, renderContactCodeHtml } from './template'

const msg = {
  to: 'bob@example.com',
  contactName: 'Bob',
  code: '424242',
  unlockUrl: 'http://localhost:3000/unlock/tok',
  title: 'Birthday',
}

describe('capture transport', () => {
  beforeEach(clearCapturedEmails)

  it('stores the code and unlock url', async () => {
    await new CaptureEmailService().sendContactCode(msg)
    const captured = getCapturedEmails()
    expect(captured).toHaveLength(1)
    expect(captured[0].code).toBe('424242')
    expect(captured[0].unlockUrl).toBe('http://localhost:3000/unlock/tok')
  })
})

describe('factory', () => {
  it('returns capture by default', () => {
    delete process.env.EMAIL_TRANSPORT
    expect(getEmailService()).toBeInstanceOf(CaptureEmailService)
  })
  it('returns resend when EMAIL_TRANSPORT=resend', () => {
    process.env.EMAIL_TRANSPORT = 'resend'
    process.env.RESEND_API_KEY = 'test'
    expect(getEmailService()).toBeInstanceOf(ResendImpl)
    process.env.EMAIL_TRANSPORT = 'capture'
  })
})

describe('template', () => {
  it('subject includes the title when present', () => {
    expect(contactCodeSubject(msg)).toContain('Birthday')
  })
  it('html includes the code and unlock url', () => {
    const html = renderContactCodeHtml(msg)
    expect(html).toContain('424242')
    expect(html).toContain('http://localhost:3000/unlock/tok')
  })
})
