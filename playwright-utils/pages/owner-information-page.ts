import { type Page, expect } from '@playwright/test'

export class OwnerInformationPage {

    constructor(private page: Page) { }

    async expectOwnerInformation(ownerName: string, ownerCity?: string, ownerTelephone?: string) {
        await expect(this.page.getByRole('heading', { level: 2, name: 'Owner Information' })).toBeVisible()
        // Only the owner table has row headers; the pet rows use dt/dd instead
        await expect(this.page.getByRole('row').filter({ has: this.page.getByRole('rowheader', { name: 'Name', exact: true }) })
            .getByRole('cell')).toHaveText(ownerName)
        // Check the owner city only if it is passed as an argument
        if (ownerCity) {
            await expect(this.page.getByRole('row').filter({ has: this.page.getByRole('rowheader', { name: 'City', exact: true }) })
                .getByRole('cell')).toHaveText(ownerCity)
        }
        if (ownerTelephone) {
            await expect(this.page.getByRole('row').filter({ has: this.page.getByRole('rowheader', { name: 'Telephone', exact: true }) })
                .getByRole('cell')).toHaveText(ownerTelephone)
        }
    }

    async expectPetInformation(petName: string, petType: string) {
        await expect(this.page.getByRole('cell', { name: `Name ${petName} Birth Date` }).locator('dt:text-is("Type") + dd')).toHaveText(petType)
    }

    async openEditPet(petName: string) {
        const clickEditPetResponse = this.page.waitForResponse(response =>
            /\/api\/pettypes$/.test(response.url()) && response.request().method() === 'GET')
        await this.page.getByRole('cell', { name: `Name ${petName} Birth Date` }).getByRole('button', { name: 'Edit Pet' }).click()
        const editPetResponse = await clickEditPetResponse
        expect(editPetResponse.ok(), `GET ${editPetResponse.url()} returned ${editPetResponse.status()}`).toBeTruthy()
        await expect(this.page).toHaveURL(/\/pets\/\d+\/edit$/)
    }

    async expectPetNames(petNames: string[]) {
        const namesRegex = new RegExp(petNames.join('|'), 'i');
        const petCells = this.page.getByRole('cell').filter({ has: this.page.getByRole('button', { name: 'Edit Pet' }) })
        await expect(petCells.first()).toBeVisible()
        for (const petCell of await petCells.all()) {
            await expect(petCell.locator('dt:text-is("Name") + dd')).toContainText(namesRegex)
        }
    }

}
