import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.title')).toHaveText('Welcome to Petclinic')
  await page.getByText('Veterinarians').click()
  await page.getByRole('link', { name: 'All' }).click()
  await expect(page.getByRole('heading')).toHaveText('Veterinarians')
})

test('Validate selected specialities', async ({ page }) => {

  const helenLearyRow = page.getByRole('row', { name: 'Helen Leary' })
  await helenLearyRow.getByRole('button', { name: 'Edit Vet' }).click()

  const selectedSpecialties = page.locator('.selected-specialties')
  await expect(selectedSpecialties).toHaveText('radiology')

  await selectedSpecialties.click()
  const radiologyCheckbox = page.getByRole('checkbox', { name: 'radiology' })
  const surgeryCheckbox = page.getByRole('checkbox', { name: 'surgery' })
  const dentistryCheckbox = page.getByRole('checkbox', { name: 'dentistry' })

  await expect(radiologyCheckbox).toBeChecked()
  await expect(surgeryCheckbox).not.toBeChecked()
  await expect(dentistryCheckbox).not.toBeChecked()

  await radiologyCheckbox.uncheck()
  await surgeryCheckbox.check()
  await selectedSpecialties.click()
  await expect(selectedSpecialties).toHaveText('surgery')

  await selectedSpecialties.click()
  await dentistryCheckbox.check()
  await selectedSpecialties.click()

  await expect(selectedSpecialties).toHaveText('surgery, dentistry')
})

test('Select all specialities', async ({ page }) => {

  const rafaelOrtegaRow = page.getByRole('row', { name: 'Rafael Ortega' })
  await rafaelOrtegaRow.getByRole('button', { name: 'Edit Vet' }).click()

  const selectedSpecialties = page.locator('.selected-specialties')
  await expect(selectedSpecialties).toHaveText('surgery')

  await selectedSpecialties.click()
  const radiologyCheckbox = page.getByRole('checkbox', { name: 'radiology' })
  const surgeryCheckbox = page.getByRole('checkbox', { name: 'surgery' })
  const dentistryCheckbox = page.getByRole('checkbox', { name: 'dentistry' })

  await radiologyCheckbox.check()
  await dentistryCheckbox.check()

  await expect(radiologyCheckbox).toBeChecked()
  await expect(surgeryCheckbox).toBeChecked()
  await expect(dentistryCheckbox).toBeChecked()

  await selectedSpecialties.click()
  await expect(selectedSpecialties).toHaveText('surgery, radiology, dentistry')
})

test('Unselect all specialities', async ({ page }) => {

  const lindaDouglasRow = page.getByRole('row', { name: 'Linda Douglas' })
  await lindaDouglasRow.getByRole('button', { name: 'Edit Vet' }).click()

  const selectedSpecialties = page.locator('.selected-specialties')
  await expect(selectedSpecialties).toHaveText('dentistry, surgery')

  await selectedSpecialties.click()
  const radiologyCheckbox = page.getByRole('checkbox', { name: 'radiology' })
  const surgeryCheckbox = page.getByRole('checkbox', { name: 'surgery' })
  const dentistryCheckbox = page.getByRole('checkbox', { name: 'dentistry' })

  await radiologyCheckbox.uncheck()
  await surgeryCheckbox.uncheck()
  await dentistryCheckbox.uncheck()

  await expect(radiologyCheckbox).not.toBeChecked()
  await expect(surgeryCheckbox).not.toBeChecked()
  await expect(dentistryCheckbox).not.toBeChecked()

  await expect(selectedSpecialties).toBeEmpty()
})


