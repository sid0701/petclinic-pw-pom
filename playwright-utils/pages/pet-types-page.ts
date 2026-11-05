import { type Page, expect } from '@playwright/test'

export class PetTypesPage {
    constructor(private page: Page) {}

    // Values are bound by Angular, not rendered as text, so they are read from the live inputs
    private readPetTypeValues() {
        return this.page
            .getByRole('row')
            .getByRole('textbox')
            .evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value))
    }

    private async findPetTypeRow(petType: string) {
        // Only the body rows hold a textbox, so this skips the header row
        const petTypeRows = this.page.getByRole('row').filter({ has: this.page.getByRole('textbox') })
        await expect(petTypeRows.getByRole('textbox').first()).not.toHaveValue('')

        const liveValues = await this.readPetTypeValues()
        const rowIndex = liveValues.indexOf(petType)
        if (rowIndex === -1) {
            throw new Error(`Pet type "${petType}" not found in table. Found: ${liveValues.join(', ')}`)
        }
        return petTypeRows.nth(rowIndex)
    }

    async openEditPetType(petType: string) {
        const petTypeRow = await this.findPetTypeRow(petType)
        const clickEditResponse = this.page.waitForResponse(
            (response) => /\/api\/pettypes\/\d+$/.test(response.url()) && response.request().method() === 'GET',
        )
        await petTypeRow.getByRole('button', { name: 'Edit' }).click()
        const editResponse = await clickEditResponse
        expect(editResponse.ok(), `GET ${editResponse.url()} returned ${editResponse.status()}`).toBeTruthy()
        await expect(this.page).toHaveURL(/\/pettypes\/\d+\/edit$/)
    }

    // Input values can't be matched by a locator, so poll the live values to retry like a locator assertion
    async expectPetTypeListed(petType: string) {
        await expect
            .poll(() => this.readPetTypeValues(), { message: `"${petType}" should be listed` })
            .toContain(petType)
    }

    async expectPetTypeAtLastRow(petType: string) {
        await expect(
            this.page
                .getByRole('row')
                .filter({ has: this.page.getByRole('textbox') })
                .last()
                .getByRole('textbox'),
        ).toHaveValue(petType)
    }

    async expectPetTypeNotListed(petType: string) {
        await expect
            .poll(() => this.readPetTypeValues(), { message: `"${petType}" should not be listed` })
            .not.toContain(petType)
    }

    async addNewPetType(petType: string) {
        await this.page.getByRole('button', { name: 'Add' }).click()
        await expect(this.page.getByRole('heading', { level: 2, name: 'New Pet Type' })).toBeVisible()
        // The "Name" caption is not a <label>, so the input has no accessible name; its stable id is the only hook
        await this.page.locator('#name').fill(petType)
        const clickSaveResponse = this.page.waitForResponse(
            (response) => /\/api\/pettypes$/.test(response.url()) && response.request().method() === 'POST',
        )
        await this.page.getByRole('button', { name: 'Save' }).click()
        const saveResponse = await clickSaveResponse
        expect(saveResponse.ok(), `POST ${saveResponse.url()} returned ${saveResponse.status()}`).toBeTruthy()
    }

    // Returns the confirmation dialog's message so the test can assert it with expectDeleteDialogMessage
    async deletePetType(petType: string, { accept = true }: { accept?: boolean } = {}): Promise<string> {
        const petTypeRow = await this.findPetTypeRow(petType)

        // Only an accepted dialog sends the DELETE request
        const clickDeleteResponse = accept
            ? this.page.waitForResponse(
                  (response) =>
                      /\/api\/pettypes\/\d+$/.test(response.url()) && response.request().method() === 'DELETE',
              )
            : undefined

        // The browser dialog blocks the click until handled, so handle it in a listener and capture its message
        let dialogMessage = ''
        this.page.once('dialog', async (dialog) => {
            dialogMessage = dialog.message()
            if (accept) {
                await dialog.accept()
            } else {
                await dialog.dismiss()
            }
        })
        await petTypeRow.getByRole('button', { name: 'Delete' }).click()

        if (clickDeleteResponse) {
            const deleteResponse = await clickDeleteResponse
            expect(
                deleteResponse.ok(),
                `DELETE ${deleteResponse.url()} returned ${deleteResponse.status()}`,
            ).toBeTruthy()
        } else {
            await expect(petTypeRow.getByRole('textbox')).toHaveValue(petType)
        }
        return dialogMessage
    }

    // The dialog is a native browser dialog, not a DOM element, so its captured message is asserted directly
    // Kept async so every expect* method is awaited the same way in tests
    // eslint-disable-next-line @typescript-eslint/require-await
    async expectDeleteDialogMessage(dialogMessage: string, expectedMessage: string) {
        expect(dialogMessage).toBe(expectedMessage)
    }
}
