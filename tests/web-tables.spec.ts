import { test } from "../playwright-utils/fixtures/custom-fixtures"

test.beforeEach(async ({ pom }) => {
    await pom.headerComponent.openHome()
})

test.describe('Owners Page', () => {
    test.beforeEach(async ({ pom }) => {
        await pom.headerComponent.openOwners()
    })

    test('Owner details show the owner city and pet type', async ({ pom }) => {
        await pom.ownersPage.openOwnerInformation('Jeff Black')
        await pom.ownerInformationPage.expectOwnerInformation('Jeff Black', { city: 'Monona' })
        await pom.ownerInformationPage.expectPetInformation('Lucky', 'dog')
    })

    test('Owners list shows the number of owners in Madison', async ({ pom }) => {
        await pom.ownersPage.expectOwnerCountInCity('Madison', 4)
    })

    test('Search by last name shows only matching owners', async ({ pom }) => {
        for (const lastName of ['Black', 'Davis', 'Es']) {
            await pom.ownersPage.searchByLastName(lastName)
            await pom.ownersPage.expectLastNameInOwnerName(lastName)
        }
    })

    test('User sees a message when no owner has the searched last name', async ({ pom }) => {
        await pom.ownersPage.searchByLastName('Playwright', 404)
        await pom.ownersPage.expectNoOwnersFoundMessage('Playwright')
    })

    test('Owner found by telephone shows the same phone and pets on Owner Information', async ({ pom }) => {
        const telephone = '6085552765'
        const { ownerName, petNames } = await pom.ownersPage.openOwnerInformationByTelephone(telephone)
        await pom.ownerInformationPage.expectOwnerInformation(ownerName, { telephone })
        await pom.ownerInformationPage.expectPetNames(petNames)
    })

    test('Owners list shows the pets of owners in Madison', async ({ pom }) => {
        await pom.ownersPage.expectPetNamesInCity('Madison', ['Leo', 'George', 'Mulligan', 'Freddy'])
    })

})

test.describe('Veterinarians page', () => {
    test.beforeEach(async ({ pom }) => {
        await pom.headerComponent.openVeterinarians()
    })

    // restoreSpecialty is requested only so its teardown renames the specialty back, even if the test fails
    test('Renamed specialty shows on the vets who have it', async ({ pom, restoreSpecialty }) => {
        await pom.veterinariansPage.expectSpecialities('Rafael Ortega', 'surgery')
        await pom.headerComponent.openSpecialties()
        await pom.specialtiesPage.openEditSpecialty('surgery')
        await pom.editSpecialtyPage.updateSpecialtyName('surgery', 'dermatology')
        await pom.specialtiesPage.expectSpecialtyListed('dermatology')
        await pom.specialtiesPage.expectSpecialtyNotListed('surgery')
        await pom.headerComponent.openVeterinarians()
        await pom.veterinariansPage.expectSpecialities('Rafael Ortega', 'dermatology')
    })

    // restoreVetSpecialties tears down first (requested last), so the vet is restored before restoreSpecialty deletes the added specialty
    test('Newly added specialty can be assigned to a vet', async ({ pom, restoreSpecialty, restoreVetSpecialties }) => {
        const newSpecialty = 'oncology'
        const vetName = 'Sharon Jenkins'
        await pom.veterinariansPage.expectSpecialities(vetName)
        await pom.headerComponent.openSpecialties()
        await pom.specialtiesPage.addNewSpecialty(newSpecialty)
        await pom.specialtiesPage.expectSpecialtyListed(newSpecialty)
        const specialtyNames = await pom.specialtiesPage.readAllSpecialtyNames()
        await pom.headerComponent.openVeterinarians()
        await pom.veterinariansPage.editVeterinarian(vetName)
        await pom.editVeterinarianPage.expectSpecialityOptions(...specialtyNames)
        await pom.editVeterinarianPage.updateSpecialities(newSpecialty)
        await pom.editVeterinarianPage.saveVeterinarian()
        await pom.veterinariansPage.expectSpecialities(vetName, newSpecialty)
    })

    test('Deleted specialty no longer shows on vets', async ({ pom, restoreSpecialty, restoreVetSpecialties }) => {
        const newSpecialty = 'oncology'
        const vetName = 'Sharon Jenkins'
        await pom.veterinariansPage.expectSpecialities(vetName)
        await pom.headerComponent.openSpecialties()
        await pom.specialtiesPage.addNewSpecialty(newSpecialty)
        await pom.headerComponent.openVeterinarians()
        await pom.veterinariansPage.editVeterinarian(vetName)
        await pom.editVeterinarianPage.updateSpecialities(newSpecialty)
        await pom.editVeterinarianPage.saveVeterinarian()
        await pom.veterinariansPage.expectSpecialities(vetName, newSpecialty)
        await pom.headerComponent.openSpecialties()
        await pom.specialtiesPage.deleteSpecialty(newSpecialty)
        await pom.specialtiesPage.expectSpecialtyNotListed(newSpecialty)
        await pom.headerComponent.openVeterinarians()
        await pom.veterinariansPage.expectSpecialities(vetName)
    })
})
