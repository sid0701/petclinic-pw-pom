import { test } from "../playwright-utils/fixtures/custom-fixtures"

test.beforeEach(async ({ pom, restorePetTypes }) => {
    await pom.headerComponent.openHome()
    await pom.headerComponent.openPetTypes()
})

test('User can add a pet type and delete it by accepting the confirmation dialog', async ({ pom }) => {
    await pom.petTypesPage.addNewPetType('pig')
    await pom.petTypesPage.expectPetTypeAtLastRow('pig')
    await pom.petTypesPage.deletePetType('pig')
    await pom.petTypesPage.expectPetTypeNotListed('pig')
})
