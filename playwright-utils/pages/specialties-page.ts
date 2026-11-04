import { type Page, expect } from "@playwright/test"

export class SpecialtiesPage {

    constructor(private page: Page) { }

    // Values are bound by Angular, not rendered as text, so they are read from the live inputs.
    // Scoped to rows so the New Specialty form's input is never included
    private readSpecialtyValues() {
        return this.page.getByRole('row').getByRole('textbox').evaluateAll(
            inputs => inputs.map(input => (input as HTMLInputElement).value))
    }

    private async findSpecialtyRow(specialty: string) {
        // Only the body rows hold a textbox, so this skips the header row
        const specialtyRows = this.page.getByRole('row').filter({ has: this.page.getByRole('textbox') })
        await expect(specialtyRows.getByRole('textbox').first()).not.toHaveValue('')

        const liveValues = await this.readSpecialtyValues()
        const rowIndex = liveValues.indexOf(specialty)
        if (rowIndex === -1) {
            throw new Error(`Specialty "${specialty}" not found in table. Found: ${liveValues.join(', ')}`)
        }
        return specialtyRows.nth(rowIndex)
    }

    async openEditSpecialty(specialty: string) {
        const specialtyRow = await this.findSpecialtyRow(specialty)
        const clickEditResponse = this.page.waitForResponse(response =>
            /\/api\/specialties\/\d+$/.test(response.url()) && response.request().method() === 'GET')
        await specialtyRow.getByRole('button', { name: 'Edit' }).click()
        const editResponse = await clickEditResponse
        expect(editResponse.ok(), `GET ${editResponse.url()} returned ${editResponse.status()}`).toBeTruthy()
        await expect(this.page).toHaveURL(/\/specialties\/\d+\/edit$/)
    }

    // Input values can't be matched by a locator, so poll the live values to retry like a locator assertion
    async expectSpecialtyListed(specialty: string) {
        await expect.poll(() => this.readSpecialtyValues(), { message: `"${specialty}" should be listed` }).toContain(specialty)
    }

    async expectSpecialtyNotListed(specialty: string) {
        await expect.poll(() => this.readSpecialtyValues(), { message: `"${specialty}" should not be listed` }).not.toContain(specialty)
    }

    async readAllSpecialtyNames() {
        // evaluateAll doesn't auto-wait, so wait until the rows have loaded their values
        await expect(this.page.getByRole('row').getByRole('textbox').first()).not.toHaveValue('')
        return this.readSpecialtyValues()
    }

    async addNewSpecialty(specialty: string) {
        await this.page.getByRole('button', { name: 'Add' }).click()
        await expect(this.page.getByRole('heading', { level: 2, name: 'New Specialty' })).toBeVisible()
        // The "Name" caption is not a <label>, so the input has no accessible name; its stable id is the only hook
        await this.page.locator('#name').fill(specialty)
        const clickSaveResponse = this.page.waitForResponse(response =>
            /\/api\/specialties$/.test(response.url()) && response.request().method() === 'POST')
        await this.page.getByRole('button', { name: 'Save' }).click()
        const saveResponse = await clickSaveResponse
        expect(saveResponse.ok(), `POST ${saveResponse.url()} returned ${saveResponse.status()}`).toBeTruthy()
        // The form closes once the specialty is saved
        await expect(this.page.getByRole('heading', { level: 2, name: 'New Specialty' })).toBeHidden()
    }

    async deleteSpecialty(specialty: string) {
        const specialtyRow = await this.findSpecialtyRow(specialty)
        const clickDeleteResponse = this.page.waitForResponse(response =>
            /\/api\/specialties\/\d+$/.test(response.url()) && response.request().method() === 'DELETE')
        await specialtyRow.getByRole('button', { name: 'Delete' }).click()
        const deleteResponse = await clickDeleteResponse
        expect(deleteResponse.ok(), `DELETE ${deleteResponse.url()} returned ${deleteResponse.status()}`).toBeTruthy()
    }
}
