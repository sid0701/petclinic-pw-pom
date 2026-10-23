import { test } from "../playwright-utils/fixtures/custom-fixtures"

test.beforeEach(async ({ pom, restorePetTypeOfPets }) => {
    await pom.headerComponent.openHome()
    await pom.headerComponent.openOwners()
})

test('Validate selected pet types from the list', async ({ pom }) => {
    await pom.ownersPage.openOwnerInformation('George Franklin')
    await pom.ownerInformationPage.expectOwnerInformation('George Franklin')
    await pom.ownerInformationPage.openEditPet('Leo')
    await pom.editPetPage.expectDetails('George Franklin', 'Leo')
    await pom.editPetPage.expectPetTypeOptions('cat', 'dog', 'lizard', 'snake', 'hamster', 'bird')
    await pom.editPetPage.expectPetType('cat')
    for (const petType of ['dog', 'lizard', 'snake', 'hamster', 'bird']) {
        await pom.editPetPage.selectPetType(petType)
        await pom.editPetPage.expectPetType(petType)
    }
})

test('Validate the pet type update', async ({ pom }) => {
    await pom.ownersPage.openOwnerInformation('Eduardo Rodriquez')
    await pom.ownerInformationPage.openEditPet('Rosy')
    await pom.editPetPage.expectDetails('Eduardo Rodriquez', 'Rosy')
    await pom.editPetPage.expectPetType('dog')
    await pom.editPetPage.updatePetType('bird')
    await pom.ownerInformationPage.expectPetInformation('Rosy', 'bird')
})
