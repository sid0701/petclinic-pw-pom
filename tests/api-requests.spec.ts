import { test, expect, request } from '@playwright/test'

test.beforeEach(async ({ page }) => {
    await page.goto('/')
})

test('Validation of delete speciality', async ({ request, page }) => {

    const addSpecialtyResponse = await request.post('https://petclinic-api.bondaracademy.com/petclinic/api/specialties', {
        data: { "name": "api testing expert" }
    })
    expect(addSpecialtyResponse.status()).toEqual(201)
    await page.getByText('Specialties').click()
    await expect(page.getByRole('textbox').last()).toHaveValue('api testing expert')
    await page.getByRole('row', { name: 'api testing expert' }).getByRole('button', { name: 'Delete' }).click()
    await page.waitForResponse('**/specialties/**')
    await expect(page.getByRole('row', { name: 'api testing expert' })).toHaveCount(0)
})

test('Add and delete veterinarian', async ({ request, page }) => {
    const vetCreatedResponse = await request.post('https://petclinic-api.bondaracademy.com/petclinic/api/vets', {
        data: { "firstName": "Vet", "lastName": "ViaAPI", "id": null, "specialties": [] }
    })
    expect(vetCreatedResponse.status()).toEqual(201)
    const vetCreatedResponseBody = await vetCreatedResponse.json()
    const vetId = vetCreatedResponseBody.id
    const vetFullName = `${vetCreatedResponseBody.firstName} ${vetCreatedResponseBody.lastName}`

    await page.getByText('Veterinarians').click()
    await page.getByRole('link', { name: 'All' }).click()
    await expect(page.getByRole('row', { name: vetFullName }).locator('td').nth(1)).toBeEmpty()
    await page.getByRole('row', { name: vetFullName }).getByRole('button', { name: 'Edit Vet' }).click()
    await page.locator('.dropdown-display').click()
    await page.getByRole('checkbox', { name: 'dentistry' }).check()
    await page.locator('.dropdown-display').click()
    await page.getByRole('button', { name: 'Save Vet' }).click()
    await expect(page.getByRole('row', { name: vetFullName }).locator('td').nth(1)).toHaveText('dentistry')

    const deleteVetResponse = await request.delete(`https://petclinic-api.bondaracademy.com/petclinic/api/vets/${vetId}`)
    expect(deleteVetResponse.status()).toEqual(204)
    const listOfVetsResponse = await request.get('https://petclinic-api.bondaracademy.com/petclinic/api/vets')
    expect(await listOfVetsResponse.json()).not.toContainEqual(
        expect.objectContaining({ "lastName": "ViaAPI" })
    )
})

test('New speciality is displayed', async ({ request, page }) => {
    const addSpecialtyResponse = await request.post('https://petclinic-api.bondaracademy.com/petclinic/api/specialties', {
        data: { "name": "api testing ninja" }
    })
    expect(addSpecialtyResponse.status()).toEqual(201)
    const addSpecialtyResponseBody = await addSpecialtyResponse.json()
    const specialityId = addSpecialtyResponseBody.id


    const getSpecialityResponse = await request.get('https://petclinic-api.bondaracademy.com/petclinic/api/specialties')
    let surgerySpecialityId;
    for (const currentSpecialityObject of await getSpecialityResponse.json()) {
        if (currentSpecialityObject.name == 'surgery') {
            surgerySpecialityId = currentSpecialityObject.id
            break
        }
    }

    const addVetResponse = await request.post('https://petclinic-api.bondaracademy.com/petclinic/api/vets', {
        data: { "firstName": "Vet", "lastName": "ViaAPITwo", "id": null, "specialties": [{ "id": surgerySpecialityId, "name": "surgery" }] }
    })
    expect(addVetResponse.status()).toEqual(201)
    const addVetResponseBody = await addVetResponse.json()
    const vetId = addVetResponseBody.id

    await page.getByText('Veterinarians').click()
    await page.getByRole('link', { name: 'All' }).click()
    await expect(page.getByRole('row', { name: 'Vet ViaAPITwo' }).locator('td').nth(1)).toHaveText('surgery')
    await page.getByRole('row', { name: 'Vet ViaAPITwo' }).getByRole('button', { name: 'Edit Vet' }).click()
    await page.locator('.dropdown-display').click()
    await page.getByRole('checkbox', { name: 'Surgery' }).uncheck()
    await page.getByRole('checkbox', { name: 'api testing ninja' }).check()
    await page.locator('.dropdown-display').click()
    await page.getByRole('button', { name: 'Save Vet' }).click()
    await expect(page.getByRole('row', { name: 'Vet ViaAPITwo' }).locator('td').nth(1)).toHaveText('api testing ninja')

    const deleteVetResponse = await request.delete(`https://petclinic-api.bondaracademy.com/petclinic/api/vets/${vetId}`)
    expect(deleteVetResponse.status()).toEqual(204)

    const deleteSpecialityResponse = await request.delete(`https://petclinic-api.bondaracademy.com/petclinic/api/specialties/${specialityId}`)
    expect(deleteSpecialityResponse.status()).toEqual(204)

    await page.getByRole('link', { name: 'Specialties' }).click()
    await page.waitForResponse('**/specialties')
    await expect(page.getByRole('textbox').last()).not.toHaveValue('api testing ninja')
})
