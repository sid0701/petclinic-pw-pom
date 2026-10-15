import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.getByText('Pet Types').click()
  await expect(page.getByRole('heading')).toHaveText('Pet Types')
})

test('Update pet type', async ({ page }) => {
  const firstPetRow = page.locator('tbody tr').filter({ has: page.locator('input[id="0"]') })
  await firstPetRow.getByRole('button', { name: 'Edit' }).click()
  await expect(page.getByRole('heading')).toHaveText('Edit Pet Type')
  const editPetTypeNameField = page.getByRole('textbox')
  await expect(editPetTypeNameField).toHaveValue('cat')
  await editPetTypeNameField.fill('rabbit')
  await page.getByRole('button', { name: 'Update' }).click()
  await expect(firstPetRow.getByRole('textbox')).toHaveValue('rabbit')
  await firstPetRow.getByRole('button', { name: 'Edit' }).click()
  await expect(editPetTypeNameField).toHaveValue('rabbit')
  await editPetTypeNameField.fill('cat')
  await page.getByRole('button', { name: 'Update' }).click()
  await expect(firstPetRow.getByRole('textbox')).toHaveValue('cat')
})

test('Cancel pet type update', async ({ page }) => {
  const secondPetRow = page.locator('tbody tr').filter({ has: page.locator('input[id="1"]') })
  await secondPetRow.getByRole('button', { name: 'Edit' }).click()
  const editPetTypeNameField = page.getByRole('textbox')
  await expect(editPetTypeNameField).toHaveValue('dog')
  await editPetTypeNameField.fill('moose')
  await expect(editPetTypeNameField).toHaveValue('moose')
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(secondPetRow.getByRole('textbox')).toHaveValue('dog')
})

test('Validation of pet type name is required', async ({ page }) => {
  const thirdPetRow = page.locator('tbody tr').filter({ has: page.locator('input[id="2"]') })
  await thirdPetRow.getByRole('button', { name: 'Edit' }).click()
  const editPetTypeNameField = page.getByRole('textbox')
  await expect(editPetTypeNameField).toHaveValue('lizard')
  await editPetTypeNameField.clear()
  await expect(page.locator('.help-block')).toHaveText('Name is required')
  await page.getByRole('button', { name: 'Update' }).click()
  await expect(page.getByRole('heading')).toHaveText('Edit Pet Type')
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(thirdPetRow.getByRole('textbox')).toHaveValue('lizard')
})