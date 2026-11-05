import { type Page, expect } from '@playwright/test'

export class VeterinariansPage {
    constructor(private page: Page) {}

    async editVeterinarian(vetName: string) {
        const clickEditResponse = this.page.waitForResponse(
            (response) => /\/api\/vets\/\d+$/.test(response.url()) && response.request().method() === 'GET',
        )
        await this.page
            .getByRole('row')
            .filter({ has: this.page.getByRole('cell', { name: vetName, exact: true }) })
            .getByRole('button', { name: 'Edit Vet' })
            .click()
        const editResponse = await clickEditResponse
        expect(editResponse.ok(), `GET ${editResponse.url()} returned ${editResponse.status()}`).toBeTruthy()
        await expect(this.page).toHaveURL(/\/vets\/\d+\/edit$/)
    }

    async expectSpecialities(vetName: string, ...specialities: string[]) {
        // Columns are Name, Specialties, Edit, Delete; each specialty renders on its own line and the order is not stable,
        // so compare the names sorted. expect.poll retries like a locator assertion, and an empty cell gives []
        const specialitiesCell = this.page
            .getByRole('row')
            .filter({ has: this.page.getByRole('cell', { name: vetName, exact: true }) })
            .getByRole('cell')
            .nth(1)
        await expect
            .poll(
                async () =>
                    (await specialitiesCell.innerText())
                        .split('\n')
                        .map((specialityName) => specialityName.trim())
                        .filter(Boolean)
                        .sort(),
                {
                    message: `${vetName} should have specialities: ${specialities.join(', ') || 'none'}`,
                },
            )
            .toEqual([...specialities].sort())
    }
}
