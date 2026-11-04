import { test } from "../playwright-utils/fixtures/custom-fixtures"

test.describe('Pet type delete dialog', () => {
    // restorePetTypes is requested only so its teardown removes any pet type the test adds
    test.beforeEach(async ({ pom, restorePetTypes }) => {
        await pom.headerComponent.openHome()
        await pom.headerComponent.openPetTypes()
    })

    test('User can add a pet type and delete it by accepting the confirmation dialog', async ({ pom }) => {
        const petType = `pig-${Date.now()}`
        await pom.petTypesPage.addNewPetType(petType)
        await pom.petTypesPage.expectPetTypeAtLastRow(petType)
        const dialogMessage = await pom.petTypesPage.deletePetType(petType)
        await pom.petTypesPage.expectDeleteDialogMessage(dialogMessage, 'Delete the pet type?')
        await pom.petTypesPage.expectPetTypeNotListed(petType)
    })

    test('User keeps a pet type by dismissing the confirmation dialog', async ({ pom }) => {
        const petType = `pig-${Date.now()}`
        await pom.petTypesPage.addNewPetType(petType)
        await pom.petTypesPage.expectPetTypeAtLastRow(petType)
        const dialogMessage = await pom.petTypesPage.deletePetType(petType, { accept: false })
        await pom.petTypesPage.expectDeleteDialogMessage(dialogMessage, 'Delete the pet type?')
        await pom.petTypesPage.expectPetTypeAtLastRow(petType)
    })
})
