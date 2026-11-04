import { type Page, expect } from "@playwright/test";

export class HeaderComponent {

    constructor(private page: Page) { }

    async openHome() {
        await this.page.goto('/')
        await expect(this.page.getByRole('heading', { level: 1 })).toHaveText('Welcome to Petclinic')
    }

    async openPetTypes() {
        await this.page.getByRole('link', { name: 'Pet Types' }).click()
        await expect(this.page).toHaveURL('/pettypes')
        await expect(this.page.getByRole('heading')).toHaveText('Pet Types')
    }

    async openVeterinarians() {
        await this.page.getByRole('button', { name: 'Veterinarians' }).click()
        await this.page.getByRole('link', { name: 'All' }).click()
        await expect(this.page).toHaveURL('/vets')
        await expect(this.page.getByRole('heading', { level: 2 })).toHaveText('Veterinarians')
    }

    async openOwners() {
        await this.page.getByRole('button', { name: 'Owners' }).click()
        // The heading renders before the owners list arrives, so wait for the list's API response
        const ownersResponse = this.page.waitForResponse(response =>
            /\/api\/owners(\?.*)?$/.test(response.url()) && response.request().method() === 'GET')
        await this.page.getByRole('link', { name: 'Search' }).click()
        const response = await ownersResponse
        expect(response.ok(), `GET ${response.url()} returned ${response.status()}`).toBeTruthy()
        await expect(this.page).toHaveURL('/owners')
        await expect(this.page.getByRole('heading', { level: 2 })).toHaveText('Owners')
    }
}