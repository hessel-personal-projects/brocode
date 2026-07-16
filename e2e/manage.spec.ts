import { test, expect } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'

test('manage page shows the creator code, resends, and deletes', async ({ page, request }) => {
  const file = fs.readFileSync(path.join(__dirname, 'fixtures/tiny.png'))
  const res = await request.post('/api/brocodes', {
    multipart: {
      creatorName: 'Alice',
      contacts: JSON.stringify([{ name: 'Bob', email: 'bob@example.com' }]),
      file: { name: 'tiny.png', mimeType: 'image/png', buffer: file },
    },
  })
  const { managementToken } = await res.json()

  await page.goto(`/manage/${managementToken}`)
  await expect(page.getByTestId('creator-code')).toHaveText(/^\d{6}$/)

  await page.locator('[data-testid^="resend-"]').first().click()
  await expect(page.getByTestId('notice')).toHaveText('Email re-sent')

  page.on('dialog', (d) => d.accept())
  await page.getByTestId('delete').click()
  await expect(page.getByTestId('deleted')).toBeVisible()
})
