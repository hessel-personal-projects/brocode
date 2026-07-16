import { test, expect } from '@playwright/test'
import path from 'node:path'

test('create shows management link and creator code', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('creator-name').fill('Alice')
  await page.getByTestId('title').fill('Party pic')
  await page.getByTestId('file').setInputFiles(path.join(__dirname, 'fixtures/tiny.png'))
  await page.getByTestId('contact-name-0').fill('Bob')
  await page.getByTestId('contact-email-0').fill('bob@example.com')
  await page.getByTestId('submit').click()

  await expect(page.getByTestId('creator-code')).toHaveText(/^\d{6}$/)
  await expect(page.getByTestId('manage-link')).toContainText('/manage/')
})
