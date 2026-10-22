import { test } from "../playwright-utils/fixtures/custom-fixtures"

test.beforeEach(async ({ pom, restoreVetSpecialties }) => {
    await pom.headerComponent.openHome()
    await pom.headerComponent.openVeterinarians()
})

test('Validate selected specialities', async ({ pom }) => {
    await pom.veterinariansPage.editVeterinarian('Helen Leary')
    await pom.editVeterinarianPage.expectSelectedSpecialities('radiology')
    await pom.editVeterinarianPage.updateSpecialities('surgery')
    await pom.editVeterinarianPage.expectSelectedSpecialities('surgery')
    await pom.editVeterinarianPage.updateSpecialities('surgery', 'dentistry')
    await pom.editVeterinarianPage.expectSelectedSpecialities('surgery', 'dentistry')
})

test('Select all specialities', async ({ pom }) => {
    await pom.veterinariansPage.editVeterinarian('Rafael Ortega')
    await pom.editVeterinarianPage.expectSelectedSpecialities('surgery')
    await pom.editVeterinarianPage.updateSpecialities('dentistry', 'surgery', 'radiology')
    await pom.editVeterinarianPage.expectSelectedSpecialities('dentistry', 'surgery', 'radiology')
})

test('Unselect all specialities', async ({ pom }) => {
    await pom.veterinariansPage.editVeterinarian('Linda Douglas')
    await pom.editVeterinarianPage.expectSelectedSpecialities('surgery', 'dentistry')
    await pom.editVeterinarianPage.updateSpecialities()
    await pom.editVeterinarianPage.expectSelectedSpecialities()
})