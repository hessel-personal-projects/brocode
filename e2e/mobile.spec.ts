import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const MOBILE = { width: 375, height: 812 }

test('create page has no horizontal overflow at 375px', async ({ page }) => {
  await page.setViewportSize(MOBILE)
  await page.goto('/')
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(overflow).toBe(false)
})

test('create page stacks panels vertically at 375px', async ({ page }) => {
  await page.setViewportSize(MOBILE)
  await page.goto('/')

  const paramsLabel = page.locator('text=PAYLOAD PARAMETERS')
  const uploadLabel = page.locator('text=PAYLOAD').nth(1)

  const paramsBox = await paramsLabel.boundingBox()
  const uploadBox = await uploadLabel.boundingBox()

  // Stacked: upload panel y-position is below params panel
  expect(uploadBox!.y).toBeGreaterThan(paramsBox!.y + 50)
  // Both panels are full-width (> 330px on a 375px screen)
  expect(paramsBox!.width).toBeGreaterThan(330)
  expect(uploadBox!.width).toBeGreaterThan(330)
})
