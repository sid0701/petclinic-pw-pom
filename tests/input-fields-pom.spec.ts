import { test } from "../playwright-utils/fixtures/custom-fixtures"

test.beforeEach(async ({ pom, restorePetTypes }) => {
  await pom.headerComponent.openHome()
  await pom.headerComponent.openPetTypes()
})

test('User can rename a pet type and rename it back', async ({ pom }) => {
  const rowId = await pom.petTypesPage.openEditPetType('cat')
  await pom.editPetTypePage.updatePetTypeName('cat', 'rabbit')
  await pom.petTypesPage.expectPetTypeAtRow(rowId, 'rabbit')
  await pom.petTypesPage.openEditPetType('rabbit')
  await pom.editPetTypePage.updatePetTypeName('rabbit', 'cat')
  await pom.petTypesPage.expectPetTypeAtRow(rowId, 'cat')
})

test('User cancelling a pet type edit keeps the original name', async ({ pom }) => {
  const rowId = await pom.petTypesPage.openEditPetType('dog')
  await pom.editPetTypePage.cancelPetTypeNameEdit('dog', 'moose')
  await pom.petTypesPage.expectPetTypeAtRow(rowId, 'dog')
})

test('User sees a required-name error when saving a blank pet type', async ({ pom }) => {
  const rowId = await pom.petTypesPage.openEditPetType('lizard')
  await pom.editPetTypePage.submitBlankPetTypeName('lizard')
  await pom.editPetTypePage.expectValidationMessage('Name is required')
  await pom.editPetTypePage.expectHeading('Edit Pet Type')
  await pom.editPetTypePage.cancelPetTypeNameEdit('')
  await pom.petTypesPage.expectPetTypeAtRow(rowId, 'lizard')
})
