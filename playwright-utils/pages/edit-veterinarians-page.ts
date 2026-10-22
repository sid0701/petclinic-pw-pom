import { type Page, expect } from '@playwright/test'

export class EditVeterinarianPage {

    constructor(private page: Page) { }

    async expectSelectedSpecialities(...currentSpecialities: string[]) {
        await expect(this.page.getByRole('heading', { level: 2 })).toHaveText('Edit Veterinarian')
        // The display order depends on save and click order, so compare the names sorted; expect.poll retries like a locator assertion
        await expect.poll(async () => (await this.page.locator('.selected-specialties').textContent())!
            .split(',').map(specialityName => specialityName.trim()).filter(Boolean).sort(), {
            message: `Selected specialities should be: ${currentSpecialities.join(', ') || 'none'}`
        }).toEqual([...currentSpecialities].sort())

        // Open the dropdown only if it is closed; clicking it while open would close it
        if (!await this.page.getByRole('checkbox').first().isVisible()) {
            await this.page.locator('.selected-specialties').click()
        }

        const checkboxes = this.page.getByRole('checkbox')
        await expect(checkboxes.first()).toBeVisible()          // all() doesn't auto-wait

        for (const checkbox of await checkboxes.all()) {
            const specialityName = await checkbox.getAttribute('id')
            const shouldBeChecked = currentSpecialities.includes(specialityName!)
            await expect(checkbox, `${specialityName} should be ${shouldBeChecked ? 'checked' : 'unchecked'}`)
                .toBeChecked({ checked: shouldBeChecked })
        }
    }

    // Leaves exactly the given specialities checked and unchecks all the others
    async updateSpecialities(...newSpecialities: string[]) {
        // Open the dropdown only if it is closed; clicking it while open would close it
        await expect(this.page.locator('.selected-specialties')).toBeVisible()
        if (!await this.page.getByRole('checkbox').first().isVisible()) {
            await this.page.locator('.selected-specialties').click()
        }

        const checkboxes = this.page.getByRole('checkbox')
        await expect(checkboxes.first()).toBeVisible()          // all() doesn't auto-wait

        // setChecked() skips boxes already in the target state and fails if the state doesn't change
        for (const checkbox of await checkboxes.all()) {
            const specialityName = await checkbox.getAttribute('id')
            await checkbox.setChecked(newSpecialities.includes(specialityName!))
        }
    }
}