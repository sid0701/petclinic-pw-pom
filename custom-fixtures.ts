import { test as base, expect, Expect } from '@playwright/test'
import { faker } from '@faker-js/faker'

export type TestOptions = {
    testOwner: string
}

export const test = base.extend<TestOptions>({
    testOwner: async ({ request }, use) => {

        //Setting up Test Resources as a part of precondition
        const ownerFirstName = faker.person.firstName()
        const ownerLastName = faker.person.lastName()
        const ownerFullName = `${ownerFirstName} ${ownerLastName}`
        const ownerAddress = faker.location.streetAddress()
        const ownerCity = faker.location.city()
        const ownerTelephone = faker.phone.number({ style: 'mobile' })

        const createOwnerResponse = await request.post('https://petclinic-api.bondaracademy.com/petclinic/api/owners', {
            data: { "id": null, "firstName": ownerFirstName, "lastName": ownerLastName, "address": ownerAddress, "city": ownerCity, "telephone": ownerTelephone }
        })
        const createOwnerResponseBody = await createOwnerResponse.json()
        const ownerId = createOwnerResponseBody.id


        const petName = faker.animal.petName()
        const petDOB = faker.date.birthdate({ min: 0, max: 10, mode: 'age' })
        const petType = 'dog'
        let petTypeId

        const petTypesResponse = await request.get('https://petclinic-api.bondaracademy.com/petclinic/api/pettypes')
        for (const petTypeCurrentObject of await petTypesResponse.json()) {
            if (petTypeCurrentObject.name == petType) {
                petTypeId = petTypeCurrentObject.id
                break
            }
        }

        const addPetResponse = await request.post(`https://petclinic-api.bondaracademy.com/petclinic/api/owners/${ownerId}/pets`, {
            data: {
                "id": null, "owner": { "firstName": ownerFirstName, "lastName": ownerLastName, "address": ownerAddress, "city": ownerCity, "telephone": ownerTelephone, "id": `${ownerId}`, "pets": [] }, "name": petName, "birthDate": petDOB, "pettype": petType, "type": { "name": petType, "id": petTypeId }
            }
        })
        const addPetResponseBody = await addPetResponse.json()
        const petId = addPetResponseBody.id

        const dateOfVisit = faker.date.recent()
        const descriptionOfVisit = 'Description of visit added via API'
        const addPetVisitResponse = await request.post(`https://petclinic-api.bondaracademy.com/petclinic/api/owners/${ownerId}/pets/${petId}/visits`, {
            data: { "date": dateOfVisit, "description": descriptionOfVisit, "id": null, "pet": { "name": petName, "birthDate": petDOB, "type": { "name": petType, "id": petTypeId }, "id": petId, "ownerId": ownerId, "visits": [] } }
        })

        await use(ownerFullName)

        //Teardown
        const deleteOwnerResponse = await request.delete(`https://petclinic-api.bondaracademy.com/petclinic/api/owners/${ownerId}`)
        expect(deleteOwnerResponse.status()).toEqual(204)
    }
})