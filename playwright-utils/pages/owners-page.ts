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

    async expectOwnerCountInCity(cityName: string, expectedCount: number) {
        // :nth-child(3) is evaluated per row, so this matches the City cell of every row
        await expect(this.page.locator('tbody tr td:nth-child(3)').getByText(cityName, { exact: true }))
            .toHaveCount(expectedCount)
    }

    async searchByLastName(lastName: string, expectedStatus = 200) {
        await this.page.getByRole('textbox').fill(lastName)

        const findOwnerClickResponse = this.page.waitForResponse(response =>
            /\/api\/owners\?lastName=/.test(response.url()) && response.request().method() === 'GET')
        await this.page.getByRole('button', { name: 'Find Owner' }).click()
        const findOwnerResponse = await findOwnerClickResponse
        expect(findOwnerResponse.status(), `GET ${findOwnerResponse.url()} returned ${findOwnerResponse.status()}`).toBe(expectedStatus)
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

    async openOwnerInformationUsingTelephone(telephone: string): Promise<string[]> {
        const ownerRow = this.page.locator('tbody tr').filter({ has: this.page.getByText(telephone) })
        await expect(ownerRow).toBeVisible()
        const petCells = ownerRow.getByRole('cell').getByRole('row')
        //If the ownerhas pets then return the list of pets otherwise return a blank array
        if (petCells)
            return await petCells.allTextContents()

        await ownerRow.getByRole('link').click()
        return []
    }

}
