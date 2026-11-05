import { type Locator, type Page, expect } from '@playwright/test'

export class OwnersPage {
    constructor(private page: Page) {}

    async openOwnerInformation(ownerName: string) {
        await this.openOwnerInformationFromLink(this.page.getByRole('cell').getByRole('link', { name: ownerName }))
    }

    // Shared by both open methods: clicks the owner's name link, then confirms the owner details loaded
    private async openOwnerInformationFromLink(ownerLink: Locator) {
        const ownerClickResponse = this.page.waitForResponse(
            (response) => /\/api\/owners\/\d+$/.test(response.url()) && response.request().method() === 'GET',
        )
        await ownerLink.click()
        const clickResponse = await ownerClickResponse
        expect(clickResponse.ok(), `GET ${clickResponse.url()} returned ${clickResponse.status()}`).toBeTruthy()
        await expect(this.page).toHaveURL(/\/owners\/\d+$/)
    }

    async expectOwnerCountInCity(cityName: string, expectedCount: number) {
        // Only City cells hold exactly the city name, so this counts one cell per owner in that city
        await expect(this.page.getByRole('cell', { name: cityName, exact: true })).toHaveCount(expectedCount)
    }

    async expectPetNamesInCity(cityName: string, petNames: string[]) {
        // Rows of owners in the city, then the nested pet rows (only the Pets cell holds a nested table).
        // toHaveText with an array checks the count, the table order and an exact match for every name
        await expect(
            this.page
                .getByRole('row')
                .filter({ has: this.page.getByRole('cell', { name: cityName, exact: true }) })
                .getByRole('cell')
                .getByRole('row'),
        ).toHaveText(petNames)
    }

    async searchByLastName(lastName: string, expectedStatus = 200) {
        await this.page.getByRole('textbox').fill(lastName)

        const findOwnerClickResponse = this.page.waitForResponse(
            (response) => /\/api\/owners\?lastName=/.test(response.url()) && response.request().method() === 'GET',
        )
        await this.page.getByRole('button', { name: 'Find Owner' }).click()
        const findOwnerResponse = await findOwnerClickResponse
        expect(
            findOwnerResponse.status(),
            `GET ${findOwnerResponse.url()} returned ${findOwnerResponse.status()}`,
        ).toBe(expectedStatus)
    }

    async expectNoOwnersFoundMessage(lastName: string) {
        await expect(this.page.getByText(`No owners with LastName starting with "${lastName}"`)).toBeVisible()
    }

    async expectLastNameInOwnerName(lastName: string) {
        // Last word of the name (after the final space) must contain lastName, ignoring case
        const escapedLastName = lastName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const lastNamePattern = new RegExp(`\\s\\S*${escapedLastName}\\S*\\s*$`, 'i')
        // Only the Name cell holds a link; 'tbody tr' would also match the nested pets table rows
        const ownerNameLinks = this.page.getByRole('cell').getByRole('link')
        await expect(ownerNameLinks.first()).toBeVisible()
        for (const ownerNameLink of await ownerNameLinks.all()) {
            await expect(ownerNameLink).toHaveText(lastNamePattern)
        }
    }

    // Returns the owner name and pet names shown in the list, so the test can check them on the Owner Information page
    async openOwnerInformationByTelephone(telephone: string): Promise<{ ownerName: string; petNames: string[] }> {
        // The exact Telephone cell pins the row; the nested pet rows hold no telephone cell, so only the owner row matches
        const ownerRow = this.page
            .getByRole('row')
            .filter({ has: this.page.getByRole('cell', { name: telephone, exact: true }) })
        await expect(ownerRow).toBeVisible()
        // The pet rows render together with the owner row, so after the guard above
        // allInnerTexts() returns every pet name (an empty array when the owner has no pets).
        // It returns the rendered text, so the raw whitespace in "<tr> George </tr>" is already trimmed
        const petNames = await ownerRow.getByRole('cell').getByRole('row').allInnerTexts()
        // The Name cell holds the row's only link
        const ownerName = await ownerRow.getByRole('link').innerText()
        await this.openOwnerInformationFromLink(ownerRow.getByRole('link'))
        return { ownerName, petNames }
    }
}
