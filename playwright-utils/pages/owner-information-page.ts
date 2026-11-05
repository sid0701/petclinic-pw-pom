import { type Page, expect } from '@playwright/test'

export class OwnerInformationPage {
    constructor(private page: Page) {}

    async expectOwnerInformation(ownerName: string, { city, telephone }: { city?: string; telephone?: string } = {}) {
        await expect(this.page.getByRole('heading', { level: 2, name: 'Owner Information' })).toBeVisible()
        // The Name is always checked; City and Telephone only when they are passed.
        // Keys are the owner table's row header texts
        const expectedDetails = { Name: ownerName, City: city, Telephone: telephone }
        for (const [rowHeader, expectedValue] of Object.entries(expectedDetails)) {
            if (expectedValue === undefined) continue
            // Only the owner table has row headers; the pet rows use dt/dd instead
            await expect(
                this.page
                    .getByRole('row')
                    .filter({ has: this.page.getByRole('rowheader', { name: rowHeader, exact: true }) })
                    .getByRole('cell'),
            ).toHaveText(expectedValue)
        }
    }

    async expectPetInformation(petName: string, petType: string) {
        await expect(
            this.page.getByRole('cell', { name: `Name ${petName} Birth Date` }).locator('dt:text-is("Type") + dd'),
        ).toHaveText(petType)
    }

    async openEditPet(petName: string) {
        const clickEditPetResponse = this.page.waitForResponse(
            (response) => /\/api\/pettypes$/.test(response.url()) && response.request().method() === 'GET',
        )
        await this.page
            .getByRole('cell', { name: `Name ${petName} Birth Date` })
            .getByRole('button', { name: 'Edit Pet' })
            .click()
        const editPetResponse = await clickEditPetResponse
        expect(editPetResponse.ok(), `GET ${editPetResponse.url()} returned ${editPetResponse.status()}`).toBeTruthy()
        await expect(this.page).toHaveURL(/\/pets\/\d+\/edit$/)
    }

    async expectPetNames(petNames: string[]) {
        // toHaveText with an array checks the pet count, the order and an exact match for every name, and retries.
        // Each pet cell holds an "Edit Pet" button; its Name value is the dd after the "Name" dt
        await expect(
            this.page
                .getByRole('cell')
                .filter({ has: this.page.getByRole('button', { name: 'Edit Pet' }) })
                .locator('dt:text-is("Name") + dd'),
        ).toHaveText(petNames)
    }
}
