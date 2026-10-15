import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.title')).toHaveText('Welcome to Petclinic')
  await page.getByText('Owners').click()
  await page.getByRole('link', { name: 'Search' }).click()
  await expect(page.getByRole('heading')).toHaveText('Owners')
})

test('Validate selected pet types from the list', async ({ page }) => {

  const ownerName = 'George Franklin'
  await page.getByRole('link', { name: ownerName }).click()
  await expect(page.locator('.ownerFullName')).toHaveText(ownerName)
  await page.getByRole('button', { name: 'Edit Pet' }).click()
  await expect(page.getByRole('heading')).toHaveText('Pet')
  await expect(page.locator('#owner_name')).toHaveValue(ownerName)
  await expect(page.locator('#type1')).toHaveValue('cat')

  for (const petTypeValue of await page.locator('option').allInnerTexts()) {
    await page.locator('select').selectOption(petTypeValue)
    await expect(page.locator('#type1')).toHaveValue(petTypeValue)
  }
})

test('Validate the pet type update', async ({ page }) => {

  await page.getByRole('link', { name: 'Eduardo Rodriquez' }).click()
  const petRosySection = page.locator('td', { hasText: 'Rosy' })
  await petRosySection.getByRole('button', { name: 'Edit Pet' }).click()
  await expect(page.locator('#name')).toHaveValue('Rosy')
  await expect(page.locator('#type1')).toHaveValue('dog')
  await page.locator('select').selectOption('bird')
  await expect(page.locator('#type1')).toHaveValue('bird')
  await page.getByRole('button', { name: 'Update Pet' }).click()
  await expect(petRosySection.locator('dd').nth(2)).toHaveText('bird')

  //updating it back to its default value
  await petRosySection.getByRole('button', { name: 'Edit Pet' }).click()
  await expect(page.locator('#type1')).toHaveValue('bird')
  await page.locator('select').selectOption('dog')
  await page.getByRole('button', { name: 'Update Pet' }).click()
  await expect(petRosySection.locator('dd').nth(2)).toHaveText('dog')
})