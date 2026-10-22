import { type Page, expect } from "@playwright/test"

export class VeterinariansPage {

    constructor(private page: Page) { }

    async editVeterinarian(vetName: string) {
        const clickEditResponse = this.page.waitForResponse(response =>
            /\/api\/vets\/\d+$/.test(response.url()) && response.request().method() === 'GET')
        await this.page.getByRole('row', { name: `${vetName}` }).getByRole('button', { name: 'Edit Vet' }).click()
        const editResponse = await clickEditResponse
        expect(editResponse.ok(), `GET ${editResponse.url()} returned ${editResponse.status()}`).toBeTruthy()
        await expect(this.page).toHaveURL(/\/vets\/\d+\/edit$/)
    }

}