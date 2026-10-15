import { type Page, expect } from "@playwright/test";

export class PetTypesPage {

    constructor(private page: Page) { }

    async openEditPetType(petType: string): Promise<string> {

        const petTypeRows = this.page.locator('tbody tr')
        // Values are bound by Angular, not rendered as text, so wait for binding before reading the live input values
        await expect(petTypeRows.getByRole('textbox').first()).not.toHaveValue('')

        const liveValues = await petTypeRows.getByRole('textbox').evaluateAll(
            inputs => inputs.map(input => (input as HTMLInputElement).value))
        const rowIndex = liveValues.indexOf(petType)
        if (rowIndex === -1) {
            throw new Error(`Pet type "${petType}" not found in table. Found: ${liveValues.join(', ')}`)
        }
        const petTypeRow = petTypeRows.nth(rowIndex)

        const petTypeRowId = await petTypeRow.getByRole('textbox').getAttribute('id')
        if (!petTypeRowId) {
            throw new Error(`Pet type "${petType}" row has no id attribute`)
        }

        const clickEditResponse = this.page.waitForResponse(response =>
            /\/api\/pettypes\/\d+$/.test(response.url()) && response.request().method() === 'GET')
        await petTypeRow.getByRole('button', { name: 'Edit' }).click()
        const editResponse = await clickEditResponse
        expect(editResponse.ok(), `GET ${editResponse.url()} returned ${editResponse.status()}`).toBeTruthy()
        await expect(this.page).toHaveURL(/\/pettypes\/\d+\/edit$/)
        return petTypeRowId
    }

    // The row id is the table row index ("0", "1", ...), not the pet type's database id
    async expectPetTypeAtRow(rowId: string, petType: string) {
        await expect(this.page.locator(`[id="${rowId}"]`)).toHaveValue(petType)
    }

}
