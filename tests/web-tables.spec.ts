import { test } from "../playwright-utils/fixtures/custom-fixtures"

test.beforeEach(async ({ pom }) => {
    await pom.headerComponent.openHome()
    await pom.headerComponent.openOwners()
})

test('Owner details show the owner city and pet type', async ({ pom }) => {
    await pom.ownersPage.openOwnerInformation('Jeff Black')
    await pom.ownerInformationPage.expectOwnerInformation('Jeff Black', 'Monona')
    await pom.ownerInformationPage.expectPetInformation('Lucky', 'dog')
})

test('Validate owners count of the Madison city', async ({ pom }) => {
    await pom.ownersPage.expectOwnerCountInCity('Madison', 4)
})

test('Validate search by Last Name', async ({ pom }) => {
    for (const lastName of ['Black', 'Davis', 'Es']) {
        await pom.ownersPage.searchByLastName(lastName)
        await pom.ownersPage.expectLastNameInOwnerName(lastName)
    }

})

test('User sees a message when no owner has the searched last name', async ({ pom }) => {
    await pom.ownersPage.searchByLastName('Playwright', 404)
    await pom.ownersPage.expectNoOwnersFoundMessage('Playwright')
})

test('Validate phone number and pet name on the Owner Information Page', async ({ pom }) => {
    const petNames = await pom.ownersPage.openOwnerInformationUsingTelephone('6085552765')
    await pom.ownerInformationPage.expectPetNames(petNames)

})