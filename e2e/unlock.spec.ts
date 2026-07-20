import { test, expect } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'

async function createBrocode(request: import('@playwright/test').APIRequestContext) {
  const file = fs.readFileSync(path.join(__dirname, 'fixtures/tiny.png'))
  const res = await request.post('/api/brocodes', {
    multipart: {
      creatorName: 'Alice',
      creatorEmail: 'alice@example.com',
      title: 'Pic',
      contacts: JSON.stringify([{ name: 'Bob', email: 'bob@example.com' }]),
      file: { name: 'tiny.png', mimeType: 'image/png', buffer: file },
    },
  })
  expect(res.ok()).toBeTruthy()
  return res.json() as Promise<{ managementToken: string; unlockToken: string }>
}

test('wrong code shows the 24h locked screen with a countdown', async ({ page, request }) => {
  const { unlockToken } = await createBrocode(request)
  await page.goto(`/unlock/${unlockToken}`)
  await expect(page.getByTestId('progress')).toContainText('0 of 2')
  await page.getByTestId('code').fill('000000')
  await page.getByTestId('enter').click()
  await expect(page.getByTestId('locked')).toBeVisible()
  await expect(page.getByTestId('countdown')).toBeVisible()
})

test('paste landing navigates to the ritual', async ({ page, request }) => {
  const { unlockToken } = await createBrocode(request)
  await page.goto('/unlock')
  await page.getByTestId('asset-id').fill(unlockToken)
  await page.getByTestId('go').click()
  await expect(page.getByTestId('progress')).toBeVisible()
})
