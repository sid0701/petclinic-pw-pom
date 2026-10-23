import { type Page, expect } from '@playwright/test'

export class OwnersPage {

    constructor(private page: Page) { }

    async openOwnerInformation(ownerName: string) {
        const ownerClickResponse = this.page.waitForResponse(response =>
            /\/api\/owners\/\d+$/.test(response.url()) && response.request().method() === 'GET')
        await this.page.getByRole('cell').getByRole('link', { name: ownerName }).click()
        const clickResponse = await ownerClickResponse
        expect(clickResponse.ok(), `GET ${clickResponse.url()} returned ${clickResponse.status()}`).toBeTruthy()
        await expect(this.page).toHaveURL(/\/owners\/\d+$/)
    }

}
