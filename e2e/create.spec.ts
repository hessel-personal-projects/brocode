import { test, expect } from '@playwright/test'
import path from 'node:path'

test('arming a brocode redirects to the manage page', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('creator-name').fill('Alice')
  await page.getByTestId('creator-email').fill('alice@example.com')
  await page.getByTestId('title').fill('Party pic')
  await page.getByTestId('file').setInputFiles(path.join(__dirname, 'fixtures/tiny.png'))
  await page.getByTestId('contact-name-0').fill('Bob')
  await page.getByTestId('contact-email-0').fill('bob@example.com')
  await page.getByTestId('submit').click()

  await page.waitForURL(/\/manage\//)
  await expect(page).toHaveURL(/\/manage\//)
})
