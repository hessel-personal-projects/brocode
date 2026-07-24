import { describe, it, expect } from 'vitest'
import { creatorManageSubject, renderCreatorManageHtml } from './template'
import type { CreatorManageEmail } from './template'

const BASE: CreatorManageEmail = {
  to: 'alice@example.com',
  creatorName: 'Alice',
  code: '987654',
  managementUrl: 'https://example.com/manage/abc',
  unlockUrl: 'https://example.com/unlock/xyz',
}

describe('creatorManageSubject', () => {
  it('includes title when present', () => {
    expect(creatorManageSubject({ ...BASE, title: 'Party pic' })).toBe(
      'Your Brocode management link for "Party pic"',
    )
  })

  it('omits title when absent', () => {
    expect(creatorManageSubject(BASE)).toBe('Your Brocode management link')
  })
})

describe('renderCreatorManageHtml', () => {
  it('contains code, manage URL, and unlock URL', () => {
    const html = renderCreatorManageHtml(BASE)
    expect(html).toContain('987654')
    expect(html).toContain('https://example.com/manage/abc')
    expect(html).toContain('https://example.com/unlock/xyz')
    expect(html).toContain('Alice')
  })

  it('escapes HTML in creator name', () => {
    const html = renderCreatorManageHtml({ ...BASE, creatorName: '<script>alert(1)</script>' })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })
})
