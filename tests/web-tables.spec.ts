import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.title')).toHaveText('Welcome to Petclinic')
})

test.describe('Testing Owners Page', () => {

    test.beforeEach(async ({ page }) => {
        await page.getByText('Owners').click()
        await page.getByRole('link', { name: 'Search' }).click()
        await page.waitForResponse('**/owners')
        await expect(page.getByRole('heading')).toHaveText('Owners')
    })

    test('Validate the pet name and the city of the owner', async ({ page }) => {
        const jeffBlackRow = page.getByRole('row', { name: 'Jeff Black' })
        await expect(jeffBlackRow.locator('td').nth(2)).toHaveText('Monona')
        await expect(jeffBlackRow.locator('td tr')).toHaveText('Lucky')
    })

    test('Validate the owners count of the Madison city', async ({ page }) => {
        await expect(page.getByRole('row', { name: 'Madison' })).toHaveCount(4)
    })

    test('Validate search by last name', async ({ page }) => {

        const lastNamesToSearch = ['Black', 'Davis', 'Es', 'Playwright']

        for (const lastNameToSearch of lastNamesToSearch) {

            await page.getByRole('textbox').fill(lastNameToSearch)
            await page.getByRole('button', { name: 'Find Owner' }).click()
            await page.waitForResponse('**/owners?lastName**')
            const ownersNameCells = page.locator('tbody tr').getByRole('link')

            /**
             * Checking if Owners with the searched last name exist or not
             * If it does then loop through all the rows to check if the Find Owner button has filtered out correctly with the last name
             */
            if (lastNameToSearch != 'Playwright') {
                for (const ownerNameCell of await ownersNameCells.all()) {
                    await expect(ownerNameCell).toContainText(lastNameToSearch)
                }
            } else {
                await expect(page.locator('.xd-container div').last()).toHaveText(`No owners with LastName starting with "${lastNameToSearch}"`)
            }
        }
    })

    test('Validate phone number and pet name on the Owner Information page', async ({ page }) => {
        const phoneNumber = '6085552765'
        const ownerPetName = await page.getByRole('row', { name: phoneNumber }).getByRole('row').textContent()
        await page.getByRole('row', { name: phoneNumber }).getByRole('link').click()
        await expect(page.getByRole('row', { name: 'Telephone' })).toContainText(phoneNumber)
        await expect(page.locator('app-pet-list')).toContainText(ownerPetName!)
    })

    test('Validate pets of the Madison city', async ({ page }) => {
        const petCellsForMadisonRows = page.getByRole('row', { name: 'Madison' }).getByRole('row')
        await expect(petCellsForMadisonRows).toHaveText(['Leo', 'George', 'Mulligan', 'Freddy'])
    })

})

test('Validate speciality update', async ({ page }) => {
    await page.getByText('Veterinarians').click()
    await page.getByRole('link', { name: 'All' }).click()
    const rafaelOrtegaSpecialityCell = page.getByRole('row', { name: 'Rafael Ortega' }).locator('td div')
    await expect(rafaelOrtegaSpecialityCell).toHaveText('surgery')

    //Updating the Surgery specility to Dermatology and checking if it reflects correctly elsewhere
    await page.getByRole('link', { name: 'Specialties' }).click()
    await expect(page.getByRole('heading')).toHaveText('Specialties')
    const rowId = await page.getByRole('row', { name: 'surgery' }).getByRole('textbox').getAttribute('id')
    await page.getByRole('row', { name: 'surgery' }).getByRole('button', { name: 'Edit' }).click()
    await expect(page.getByRole('heading')).toHaveText('Edit Specialty')
    const editSpecialityTextbox = page.getByRole('textbox')
    await expect(editSpecialityTextbox).toHaveValue('surgery')
    await editSpecialityTextbox.fill('dermatology')
    await page.getByRole('button', { name: 'Update' }).click()
    await expect(page.locator(`[id="${rowId}"]`)).toHaveValue('dermatology')
    await page.getByText('Veterinarians').click()
    await page.getByRole('link', { name: 'All' }).click()
    await expect(rafaelOrtegaSpecialityCell).toHaveText('dermatology')

    //reverting the changes
    await page.getByRole('link', { name: 'Specialties' }).click()
    await page.getByRole('row').filter({ has: page.locator(`[id="${rowId}"]`) }).getByRole('button', { name: 'Edit' }).click()
    await expect(editSpecialityTextbox).toHaveValue('dermatology')
    await editSpecialityTextbox.fill('surgery')
    await page.getByRole('button', { name: 'Update' }).click()
    await expect(page.locator(`[id="${rowId}"]`)).toHaveValue('surgery')
    await page.getByText('Veterinarians').click()
    await page.getByRole('link', { name: 'All' }).click()
    await expect(rafaelOrtegaSpecialityCell).toHaveText('surgery')
})

test('Validate speciality lists', async ({ page }) => {

    //adding a new speciality
    await page.getByRole('link', { name: 'Specialties' }).click()
    await page.getByRole('button', { name: 'Add' }).click()
    await page.locator('#name').fill('oncology')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('row').last().getByRole('textbox')).toHaveValue('oncology')
    const specialitiesList = []
    for (const specialityRow of await page.getByRole('row').getByRole('textbox').all())
        specialitiesList.push(await specialityRow.inputValue())

    //adding the newly added speciality to the veterinarian
    await page.getByText('Veterinarians').click()
    await page.getByRole('link', { name: 'All' }).click()
    const sharonJenkinsRow = page.getByRole('row', { name: 'Sharon Jenkins' })
    await sharonJenkinsRow.getByRole('button', { name: 'Edit Vet' }).click()
    await page.locator('.dropdown-display').click()
    const specialtyDropdownValues = await page.locator('.dropdown-content div label').allTextContents()
    expect(specialitiesList).toEqual(specialtyDropdownValues)
    await page.getByRole('checkbox', { name: 'oncology' }).check()
    await page.locator('.dropdown-display').click()
    await page.getByRole('button', { name: 'Save Vet' }).click()
    await expect(sharonJenkinsRow.locator('td div')).toHaveText('oncology')

    //reverting the changes
    await page.getByRole('link', { name: 'Specialties' }).click()
    await page.getByRole('row', { name: 'oncology' }).getByRole('button', { name: 'Delete' }).click()
    await page.getByText('Veterinarians').click()
    await page.getByRole('link', { name: 'All' }).click()
    await expect(sharonJenkinsRow.locator('td').nth(1)).toBeEmpty()
})