import type { ContactCodeEmail, CreatorManageEmail } from './types'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
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
      everyone enters their brocode together at one screen.</p>
      <p>Your private six-digit brocode:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:4px">${msg.code}</p>
      <p>When you're all together, open this link and take turns entering your brocodes:</p>
      <p><a href="${url}">${url}</a></p>
      <p style="color:#b00">One wrong brocode from anyone locks it for 24 hours. No retries.</p>
    </div>
  `.trim()
}

export function creatorManageSubject(msg: CreatorManageEmail): string {
  return msg.title
    ? `Your Brocode management link for "${msg.title}"`
    : 'Your Brocode management link'
}

export function renderCreatorManageHtml(msg: CreatorManageEmail): string {
  const name = escapeHtml(msg.creatorName)
  const manageUrl = escapeHtml(msg.managementUrl)
  const unlockUrl = escapeHtml(msg.unlockUrl)
  return `
    <div style="font-family:sans-serif;max-width:480px">
      <h2>Your Brocode is armed</h2>
      <p>Hi ${name}, your Brocode is ready. Your private six-digit code:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:4px">${msg.code}</p>
      <p>Manage your Brocode (operatives, resend, delete) from your mission control link — keep it private:</p>
      <p><a href="${manageUrl}">${manageUrl}</a></p>
      <p>Share this unlock link with your operatives:</p>
      <p><a href="${unlockUrl}">${unlockUrl}</a></p>
      <p style="color:#b00">One wrong brocode from anyone locks it for 24 hours. No retries.</p>
    </div>
  `.trim()
}
