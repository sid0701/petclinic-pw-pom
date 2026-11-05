import { test as base, expect } from '@playwright/test'
import { PageManager } from './page-manager'
import { petclinicApiUrl } from '../helpers/api-urls'

export type TestOptions = {
    pom: PageManager
    restorePetTypes: void
    restoreSpecialty: void
    restoreVetSpecialties: void
    restorePetTypeOfPets: void
}

type Vet = { id: number; firstName: string; lastName: string; specialties: { id: number; name: string }[] }
type Pet = { id: number; name: string; birthDate: string; type: { id: number; name: string }; ownerId: number }

export const test = base.extend<TestOptions>({
    pom: async ({ page }, use) => {
        await use(new PageManager(page))
    },

    //Snapshot pet types before the test, then restore renamed ones and delete added ones afterwards, even if the test fails
    restorePetTypes: async ({ request }, use) => {
        const originalPetTypesResponse = await request.get(`${petclinicApiUrl}/pettypes`)
        expect(
            originalPetTypesResponse.ok(),
            `GET ${originalPetTypesResponse.url()} returned ${originalPetTypesResponse.status()}`,
        ).toBeTruthy()
        const originalPetTypes = (await originalPetTypesResponse.json()) as { id: number; name: string }[]

        await use()

        const currentPetTypesResponse = await request.get(`${petclinicApiUrl}/pettypes`)
        const currentPetTypes = (await currentPetTypesResponse.json()) as { id: number; name: string }[]
        for (const originalPetType of originalPetTypes) {
            const currentPetType = currentPetTypes.find((petType) => petType.id === originalPetType.id)
            if (currentPetType && currentPetType.name !== originalPetType.name) {
                const restoreResponse = await request.put(`${petclinicApiUrl}/pettypes/${originalPetType.id}`, {
                    data: originalPetType,
                })
                expect(
                    restoreResponse.ok(),
                    `PUT ${restoreResponse.url()} returned ${restoreResponse.status()}`,
                ).toBeTruthy()
            }
        }
        for (const currentPetType of currentPetTypes) {
            if (!originalPetTypes.some((petType) => petType.id === currentPetType.id)) {
                const deleteResponse = await request.delete(`${petclinicApiUrl}/pettypes/${currentPetType.id}`)
                expect(
                    deleteResponse.ok(),
                    `DELETE ${deleteResponse.url()} returned ${deleteResponse.status()}`,
                ).toBeTruthy()
            }
        }
    },

    //Snapshot specialties before the test, then restore renamed ones and delete added ones afterwards, even if the test fails
    restoreSpecialty: async ({ request }, use) => {
        const originalSpecialtiesResponse = await request.get(`${petclinicApiUrl}/specialties`)
        expect(
            originalSpecialtiesResponse.ok(),
            `GET ${originalSpecialtiesResponse.url()} returned ${originalSpecialtiesResponse.status()}`,
        ).toBeTruthy()
        const originalSpecialties = (await originalSpecialtiesResponse.json()) as { id: number; name: string }[]

        await use()

        const currentSpecialtiesResponse = await request.get(`${petclinicApiUrl}/specialties`)
        const currentSpecialties = (await currentSpecialtiesResponse.json()) as { id: number; name: string }[]
        for (const originalSpecialty of originalSpecialties) {
            const currentSpecialty = currentSpecialties.find((specialty) => specialty.id === originalSpecialty.id)
            if (currentSpecialty && currentSpecialty.name !== originalSpecialty.name) {
                const restoreResponse = await request.put(`${petclinicApiUrl}/specialties/${originalSpecialty.id}`, {
                    data: originalSpecialty,
                })
                expect(
                    restoreResponse.ok(),
                    `PUT ${restoreResponse.url()} returned ${restoreResponse.status()}`,
                ).toBeTruthy()
            }
        }
        for (const currentSpecialty of currentSpecialties) {
            if (!originalSpecialties.some((specialty) => specialty.id === currentSpecialty.id)) {
                const deleteResponse = await request.delete(`${petclinicApiUrl}/specialties/${currentSpecialty.id}`)
                expect(
                    deleteResponse.ok(),
                    `DELETE ${deleteResponse.url()} returned ${deleteResponse.status()}`,
                ).toBeTruthy()
            }
        }
    },

    //Snapshot every vet's specialties before the test and restore any changed ones afterwards, even if the test fails
    restoreVetSpecialties: async ({ request }, use) => {
        const originalVetsResponse = await request.get(`${petclinicApiUrl}/vets`)
        expect(
            originalVetsResponse.ok(),
            `GET ${originalVetsResponse.url()} returned ${originalVetsResponse.status()}`,
        ).toBeTruthy()
        const originalVets = (await originalVetsResponse.json()) as Vet[]

        await use()

        const currentVetsResponse = await request.get(`${petclinicApiUrl}/vets`)
        const currentVets = (await currentVetsResponse.json()) as Vet[]
        const specialtyIds = (vet: Vet) =>
            vet.specialties
                .map((specialty) => specialty.id)
                .sort()
                .join(',')
        for (const originalVet of originalVets) {
            const currentVet = currentVets.find((vet) => vet.id === originalVet.id)
            if (currentVet && specialtyIds(currentVet) !== specialtyIds(originalVet)) {
                const restoreResponse = await request.put(`${petclinicApiUrl}/vets/${originalVet.id}`, {
                    data: originalVet,
                })
                expect(
                    restoreResponse.ok(),
                    `PUT ${restoreResponse.url()} returned ${restoreResponse.status()}`,
                ).toBeTruthy()
            }
        }
    },

    //Snapshot every pet's type before the test and restore any changed ones afterwards, even if the test fails
    restorePetTypeOfPets: async ({ request }, use) => {
        const originalPetsResponse = await request.get(`${petclinicApiUrl}/pets`)
        expect(
            originalPetsResponse.ok(),
            `GET ${originalPetsResponse.url()} returned ${originalPetsResponse.status()}`,
        ).toBeTruthy()
        const originalPets = (await originalPetsResponse.json()) as Pet[]

        await use()

        const currentPetsResponse = await request.get(`${petclinicApiUrl}/pets`)
        const currentPets = (await currentPetsResponse.json()) as Pet[]
        for (const originalPet of originalPets) {
            const currentPet = currentPets.find((pet) => pet.id === originalPet.id)
            if (currentPet && currentPet.type.id !== originalPet.type.id) {
                const restoreResponse = await request.put(`${petclinicApiUrl}/pets/${originalPet.id}`, {
                    data: { ...currentPet, type: originalPet.type },
                })
                expect(
                    restoreResponse.ok(),
                    `PUT ${restoreResponse.url()} returned ${restoreResponse.status()}`,
                ).toBeTruthy()
            }
        }
    },
})

export { expect }
