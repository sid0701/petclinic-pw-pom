import { type Page, expect } from "@playwright/test";

export class EditPetTypePage {

    constructor(private page: Page) { }

    async updatePetTypeName(currentPetType: string, newPetType: string) {
        await expect(this.page.getByRole('textbox')).toHaveValue(currentPetType)
        await this.page.getByRole('textbox').fill(newPetType)
        const updatePetTypeResponse = this.page.waitForResponse(response =>
            /\/api\/pettypes\/\d+$/.test(response.url()) && response.request().method() === 'PUT')
        await this.page.getByRole('button', { name: 'Update' }).click()
        const updateResponse = await updatePetTypeResponse
        expect(updateResponse.ok(), `PUT ${updateResponse.url()} returned ${updateResponse.status()}`).toBeTruthy()
        await expect(this.page).toHaveURL('/pettypes')
    }

    async submitBlankPetTypeName(currentPetType: string) {
        await expect(this.page.getByRole('textbox')).toHaveValue(currentPetType)
        await this.page.getByRole('textbox').clear()
        const updatePetTypeResponse = this.page.waitForResponse(response =>
            /\/api\/pettypes\/\d+$/.test(response.url()) && response.request().method() === 'PUT')
        await this.page.getByRole('button', { name: 'Update' }).click()
        await updatePetTypeResponse
    }

    async cancelPetTypeNameEdit(currentPetType: string, newPetType?: string) {
        await expect(this.page.getByRole('textbox')).toHaveValue(currentPetType)
        if (newPetType !== undefined) {
            await this.page.getByRole('textbox').fill(newPetType)
            await expect(this.page.getByRole('textbox')).toHaveValue(newPetType)
        }
        const cancelPetTypeResponse = this.page.waitForResponse(response =>
            /\/api\/pettypes$/.test(response.url()) && response.request().method() === 'GET')
        await this.page.getByRole('button', { name: 'Cancel' }).click()
        const cancelResponse = await cancelPetTypeResponse
        expect(cancelResponse.ok(), `GET ${cancelResponse.url()} returned ${cancelResponse.status()}`).toBeTruthy()
        await expect(this.page).toHaveURL('/pettypes')
    }

    async expectValidationMessage(message: string) {
        await expect(this.page.getByText(message)).toBeVisible()
    }

    async expectHeading(heading: string) {
        await expect(this.page.getByRole('heading')).toHaveText(heading)
    }

}
