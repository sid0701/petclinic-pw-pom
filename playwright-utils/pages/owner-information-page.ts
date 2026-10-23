import { type Page, expect } from '@playwright/test'

export class OwnerInformationPage {

    constructor(private page: Page) { }

    async expectOwnerInformation(ownerName: string) {
        await expect(this.page.getByRole('heading', { level: 2, name: 'Owner Information' })).toBeVisible()
        // Only the owner table has row headers; the pet rows use dt/dd instead
        await expect(this.page.getByRole('row').filter({ has: this.page.getByRole('rowheader', { name: 'Name', exact: true }) })
            .getByRole('cell')).toHaveText(ownerName)
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

}
