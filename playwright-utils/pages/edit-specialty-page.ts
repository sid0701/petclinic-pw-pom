import { type Page, expect } from '@playwright/test'

export class EditSpecialtyPage {
    constructor(private page: Page) {}

    async updateSpecialtyName(currentSpecialty: string, newSpecialty: string) {
        await expect(this.page.getByRole('heading', { level: 2 })).toHaveText('Edit Specialty')
        await expect(this.page.getByRole('textbox')).toHaveValue(currentSpecialty)
        await this.page.getByRole('textbox').fill(newSpecialty)
        const updateSpecialtyResponse = this.page.waitForResponse(
            (response) => /\/api\/specialties\/\d+$/.test(response.url()) && response.request().method() === 'PUT',
        )
        await this.page.getByRole('button', { name: 'Update' }).click()
        const updateResponse = await updateSpecialtyResponse
        expect(updateResponse.ok(), `PUT ${updateResponse.url()} returned ${updateResponse.status()}`).toBeTruthy()
        await expect(this.page).toHaveURL('/specialties')
    }
}
