import { test, expect, type APIRequestContext } from '@playwright/test'
import path from 'node:path'

type Captured = { to: string; code: string; unlockUrl: string }

async function createViaUI(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.getByTestId('creator-name').fill('Alice')
  await page.getByTestId('file').setInputFiles(path.join(__dirname, 'fixtures/tiny.png'))
  await page.getByTestId('contact-name-0').fill('Bob')
  await page.getByTestId('contact-email-0').fill('bob@example.com')
  await page.getByTestId('add-contact').click()
  await page.getByTestId('contact-name-1').fill('Cara')
  await page.getByTestId('contact-email-1').fill('cara@example.com')
  await page.getByTestId('submit').click()
  const creatorCode = await page.getByTestId('creator-code').textContent()
  const manageUrl = await page.getByTestId('manage-link').textContent()
  return { creatorCode: creatorCode!.trim(), manageUrl: manageUrl!.trim() }
}

async function capturedEmails(request: APIRequestContext): Promise<Captured[]> {
  const res = await request.get('/api/test/emails')
  return res.json()
}

test.beforeEach(async ({ request }) => {
  await request.delete('/api/test/emails')
})

test('happy path: create → capture codes → unlock in any order → view', async ({ page, request }) => {
  const { creatorCode } = await createViaUI(page)

  const emails = await capturedEmails(request)
  expect(emails).toHaveLength(2)
  const unlockUrl = new URL(emails[0].unlockUrl).pathname
  const bob = emails.find((e) => e.to === 'bob@example.com')!.code
  const cara = emails.find((e) => e.to === 'cara@example.com')!.code

  await page.goto(unlockUrl)
  await expect(page.getByTestId('progress')).toContainText('0 of 3')

  // any order: contact, contact, creator
  for (const code of [bob, cara, creatorCode]) {
    await page.getByTestId('code').fill(code)
    await page.getByTestId('enter').click()
  }

  // redirected to the view page; the asset renders
  await expect(page.getByTestId('asset')).toBeVisible()
})

test('detonation: one wrong code locks it for 24h', async ({ page, request }) => {
  const { creatorCode } = await createViaUI(page)
  const emails = await capturedEmails(request)
  const unlockUrl = new URL(emails[0].unlockUrl).pathname
  const bob = emails.find((e) => e.to === 'bob@example.com')!.code

  await page.goto(unlockUrl)
  await page.getByTestId('code').fill(bob) // one correct
  await page.getByTestId('enter').click()
  await expect(page.getByTestId('progress')).toContainText('1 of 3')

  await page.getByTestId('code').fill('000000') // wrong → detonate
  await page.getByTestId('enter').click()
  await expect(page.getByTestId('locked')).toBeVisible()

  // reloading stays locked, and correct codes are rejected
  await page.reload()
  await expect(page.getByTestId('locked')).toBeVisible()
  void creatorCode
})
