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
