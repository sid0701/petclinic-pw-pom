import { type Page, expect } from '@playwright/test'

export class EditPetPage {

    constructor(private page: Page) { }

    // The Owner and current-Type textboxes have no accessible name (their labels point at other inputs), so they are located by id
    async expectDetails(ownerName: string, petName: string) {
        await expect(this.page.getByRole('heading', { level: 2 })).toHaveText('Pet')
        await expect(this.page.locator('#owner_name')).toHaveValue(ownerName)
        await expect(this.page.getByRole('textbox', { name: 'Name' })).toHaveValue(petName)
    }

    async expectPetTypeOptions(...petTypes: string[]) {
        await expect(this.page.getByRole('combobox', { name: 'Type' }).getByRole('option')).toHaveText(petTypes)
    }

    async expectPetType(petType: string) {
        await expect(this.page.getByRole('combobox', { name: 'Type' })).toHaveValue(petType)
        await expect(this.page.locator('#type1')).toHaveValue(petType)
    }

    async selectPetType(petType: string) {
        await this.page.getByRole('combobox', { name: 'Type' }).selectOption(petType)
    }

    async updatePetType(petType: string) {
        await this.page.getByRole('combobox', { name: 'Type' }).selectOption(petType)
        const clickUpdatePetResponse = this.page.waitForResponse(response =>
            /\/api\/pets\/\d+$/.test(response.url()) && response.request().method() === 'PUT')
        await this.page.getByRole('button', { name: 'Update Pet' }).click()
        const updatePetResponse = await clickUpdatePetResponse
        expect(updatePetResponse.ok(), `PUT ${updatePetResponse.url()} returned ${updatePetResponse.status()}`).toBeTruthy()
        await expect(this.page).toHaveURL(/\/owners\/\d+$/)
    }
}
