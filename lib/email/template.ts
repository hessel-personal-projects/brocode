import type { ContactCodeEmail } from './types'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export function contactCodeSubject(msg: ContactCodeEmail): string {
  return msg.title ? `Your Brocode key for "${msg.title}"` : 'Your Brocode key'
}

export function renderContactCodeHtml(msg: ContactCodeEmail): string {
  const name = escapeHtml(msg.contactName)
  const url = escapeHtml(msg.unlockUrl)
  return `
    <div style="font-family:sans-serif;max-width:480px">
      <h2>You hold a Brocode key</h2>
      <p>Hi ${name}, someone locked a media asset that only opens when
      everyone enters their code together at one screen.</p>
      <p>Your private six-digit code:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:4px">${msg.code}</p>
      <p>When you're all together, open this link and take turns entering your codes:</p>
      <p><a href="${url}">${url}</a></p>
      <p style="color:#b00">One wrong code from anyone locks it for 24 hours. No retries.</p>
    </div>
  `.trim()
}
