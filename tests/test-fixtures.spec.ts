import { expect } from '@playwright/test'
import { test } from '../custom-fixtures'

test('Test with fixture', async ({ testOwner, page }) => {
    await page.goto('/')
    await page.getByText('Owners').click()
    await page.getByRole('link', { name: 'Search' }).click()
    await page.getByRole('link', { name: testOwner }).click()
    await page.getByRole('button', { name: 'Delete Visit' }).click()
    await page.waitForResponse('**/visits/**')
    await expect(page.locator('app-visit-list td')).toHaveCount(0)
    await page.getByRole('button', { name: 'Delete Pet' }).click()
    await page.waitForResponse('**/pets/**')
    await expect(page.locator('app-pet-list dd').first()).toBeEmpty()
})