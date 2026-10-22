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
}