import { type Page, expect } from '@playwright/test'

export class EditVeterinarianPage {
    constructor(private page: Page) {}

    // Returns the option checkboxes once the dropdown is open; they are hidden (and not matched by role) while it is closed
    private async openSpecialitiesDropdown() {
        // The selected-names span is empty (zero size, so not clickable) when a vet has none; the ▼ arrow is always visible
        await expect(this.page.getByText('▼')).toBeVisible()
        // Open the dropdown only if it is closed; clicking the arrow while open would close it
        if (!(await this.page.getByRole('checkbox').first().isVisible())) {
            await this.page.getByText('▼').click()
        }
        const checkboxes = this.page.getByRole('checkbox')
        await expect(checkboxes.first()).toBeVisible() // all() and evaluateAll() don't auto-wait
        return checkboxes
    }

    async expectSelectedSpecialities(...currentSpecialities: string[]) {
        await expect(this.page.getByRole('heading', { level: 2 })).toHaveText('Edit Veterinarian')
        // The display order depends on save and click order, so compare the names sorted; expect.poll retries like a locator assertion
        await expect
            .poll(
                async () =>
                    (await this.page.locator('.selected-specialties').textContent())!
                        .split(',')
                        .map((specialityName) => specialityName.trim())
                        .filter(Boolean)
                        .sort(),
                {
                    message: `Selected specialities should be: ${currentSpecialities.join(', ') || 'none'}`,
                },
            )
            .toEqual([...currentSpecialities].sort())

        const checkboxes = await this.openSpecialitiesDropdown()
        for (const checkbox of await checkboxes.all()) {
            const specialityName = await checkbox.getAttribute('id')
            const shouldBeChecked = currentSpecialities.includes(specialityName!)
            await expect(
                checkbox,
                `${specialityName} should be ${shouldBeChecked ? 'checked' : 'unchecked'}`,
            ).toBeChecked({ checked: shouldBeChecked })
        }
    }

    // Leaves exactly the given specialities checked and unchecks all the others
    async updateSpecialities(...newSpecialities: string[]) {
        const checkboxes = await this.openSpecialitiesDropdown()
        // setChecked() skips boxes already in the target state and fails if the state doesn't change
        for (const checkbox of await checkboxes.all()) {
            const specialityName = await checkbox.getAttribute('id')
            await checkbox.setChecked(newSpecialities.includes(specialityName!))
        }
        // Close the dropdown; left open, its options cover the Save button
        await this.page.getByText('▼').click()
        await expect(checkboxes.first()).toBeHidden()
    }

    // Each option is a checkbox whose id is the speciality name; the order can differ from the Specialties page, so compare sorted
    async expectSpecialityOptions(...specialities: string[]) {
        const checkboxes = await this.openSpecialitiesDropdown()
        await expect
            .poll(async () => (await checkboxes.evaluateAll((inputs) => inputs.map((input) => input.id))).sort(), {
                message: `Speciality options should be: ${specialities.join(', ')}`,
            })
            .toEqual([...specialities].sort())
    }

    async saveVeterinarian() {
        const clickSaveResponse = this.page.waitForResponse(
            (response) => /\/api\/vets\/\d+$/.test(response.url()) && response.request().method() === 'PUT',
        )
        await this.page.getByRole('button', { name: 'Save' }).click()
        const saveResponse = await clickSaveResponse
        expect(saveResponse.ok(), `PUT ${saveResponse.url()} returned ${saveResponse.status()}`).toBeTruthy()
        await expect(this.page).toHaveURL(/\/vets$/)
    }
}
