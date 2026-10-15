import { test, expect } from '@playwright/test'
import ownerspage from '../test-data/owners-page.json'
import specialties from '../test-data/specialties.json'

test.beforeEach(async ({ page }) => {
    await page.goto('/')
})

test('mocking API request', async ({ page }) => {
    await page.route('**/owners', async route => {
        await route.fulfill({
            body: JSON.stringify(ownerspage)
        })
    })
    await page.route('**/owners/2000', async route => {
        await route.fulfill({
            body: JSON.stringify(ownerspage[0])
        })
    })
    await page.getByText('Owners').click()
    await page.getByRole('link', { name: 'Search' }).click()
    await expect(page.locator('tbody a')).toHaveCount(2)
    const firstOwnerRow = page.locator('tbody tr').first()
    const ownerName = await firstOwnerRow.locator('a').textContent()
    const ownerAddress = await firstOwnerRow.locator('td').nth(1).textContent()
    const ownerCity = await firstOwnerRow.locator('td').nth(2).textContent()
    const ownerTelephone = await firstOwnerRow.locator('td').nth(3).textContent()
    const ownerPets = await firstOwnerRow.locator('td').nth(4).locator('tr').allTextContents()
    await expect(firstOwnerRow.locator('td').nth(4).locator('tr')).toHaveCount(2)
    await firstOwnerRow.locator('a').click()
    const ownerInformation = page.locator('table').first()
    await expect(ownerInformation.locator('tr').first().locator('td')).toHaveText(ownerName!)
    await expect(ownerInformation.locator('tr').nth(1).locator('td')).toHaveText(ownerAddress!)
    await expect(ownerInformation.locator('tr').nth(2).locator('td')).toHaveText(ownerCity!)
    await expect(ownerInformation.locator('tr').nth(3).locator('td')).toHaveText(ownerTelephone!)
    await expect(page.locator('app-pet-list dd:first-of-type')).toHaveText(ownerPets)
    const firstPetVisitList = page.locator('app-visit-list').first()
    await expect(firstPetVisitList.locator('table > tr')).toHaveCount(10)
})

test('Intercept API response', async ({ page }) => {
    await page.route('**/vets', async route => {
        const response = await route.fetch()
        const responseBody = await response.json()

        for (const currentResponseObject of responseBody) {
            const currentFullName = `${currentResponseObject.firstName} ${currentResponseObject.lastName}`
            if (currentFullName == 'Sharon Jenkins') {
                currentResponseObject.specialties = specialties
                break
            }
        }

        await route.fulfill({
            body: JSON.stringify(responseBody)
        })
    })
    await page.getByText('Veterinarians').click()
    await page.getByRole('link', { name: 'All' }).click()
    await expect(page.getByRole('row', { name: 'Sharon Jenkins' }).locator('div')).toHaveText(['radiology', 'surgery', 'dentistry', 'pshyciatry', 'cardiology', 'opthamology', 'paediatrics', 'hepatology', 'orthopedics', 'dermatology'])
})