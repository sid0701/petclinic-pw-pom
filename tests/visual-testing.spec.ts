import { test, expect } from '@playwright/test'

test('visual testing', async ({ page }) => {
    await page.goto('/')
    await page.getByText('Owners').click()
    await page.getByRole('link', { name: 'Add New' }).click()
    await expect(page.getByRole('button', { name: 'Add Owner' })).toHaveScreenshot()
    await page.getByRole('textbox', { name: 'First Name' }).fill('testfirstname')
    await page.getByRole('textbox', { name: 'Last Name' }).fill('testlastname')
    await page.getByRole('textbox', { name: 'Address' }).fill('testaddress')
    await page.getByRole('textbox', { name: 'City' }).fill('testcity')
    await page.getByRole('textbox', { name: 'Telephone' }).fill('00000')
    await expect(page.getByRole('button', { name: 'Add Owner' })).toHaveScreenshot()
})