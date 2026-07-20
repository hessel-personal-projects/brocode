import { test, expect } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'

test('manage page shows unlock link, delivery status, resend, and delete', async ({ page, request }) => {
  const file = fs.readFileSync(path.join(__dirname, 'fixtures/tiny.png'))
  const res = await request.post('/api/brocodes', {
    multipart: {
      creatorName: 'Alice',
      creatorEmail: 'alice@example.com',
      contacts: JSON.stringify([{ name: 'Bob', email: 'bob@example.com' }]),
      file: { name: 'tiny.png', mimeType: 'image/png', buffer: file },
    },
  })
  const { managementToken } = await res.json()

  await page.goto(`/manage/${managementToken}`)

  // Creator code is no longer shown on the manage page
  await expect(page.getByTestId('creator-code')).toHaveCount(0)

  // Unlock endpoint is visible
  await expect(page.getByTestId('unlock-url')).toContainText('/unlock/')

  // Creator email delivery section is visible
  await expect(page.locator('text=YOUR AUTHORIZATION EMAIL')).toBeVisible()

  // Resend button for contact works
  await page.locator('[data-testid^="resend-"]').first().click()
  await expect(page.getByTestId('notice')).toHaveText('Email re-sent')

  // Delete works
  page.on('dialog', (d) => d.accept())
  await page.getByTestId('delete').click()
  await expect(page.getByTestId('deleted')).toBeVisible()
})
