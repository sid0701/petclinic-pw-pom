import { test as base, expect } from '@playwright/test'
import { PageManager } from './page-manager'
import { petclinicApiUrl } from '../helpers/api-urls'

export type TestOptions = {
    pom: PageManager
    restorePetTypes: void
    restoreVetSpecialties: void
}

type Vet = { id: number, firstName: string, lastName: string, specialties: { id: number, name: string }[] }

export const test = base.extend<TestOptions>({

    pom: async ({ page }, use) => {
        await use(new PageManager(page))
    },

    //Snapshot pet type names before the test and restore any renamed ones afterwards, even if the test fails
    restorePetTypes: async ({ request }, use) => {
        const originalPetTypesResponse = await request.get(`${petclinicApiUrl}/pettypes`)
        expect(originalPetTypesResponse.ok(), `GET ${originalPetTypesResponse.url()} returned ${originalPetTypesResponse.status()}`).toBeTruthy()
        const originalPetTypes: { id: number, name: string }[] = await originalPetTypesResponse.json()

        await use()

        const currentPetTypesResponse = await request.get(`${petclinicApiUrl}/pettypes`)
        const currentPetTypes: { id: number, name: string }[] = await currentPetTypesResponse.json()
        for (const originalPetType of originalPetTypes) {
            const currentPetType = currentPetTypes.find(petType => petType.id === originalPetType.id)
            if (currentPetType && currentPetType.name !== originalPetType.name) {
                const restoreResponse = await request.put(`${petclinicApiUrl}/pettypes/${originalPetType.id}`, { data: originalPetType })
                expect(restoreResponse.ok(), `PUT ${restoreResponse.url()} returned ${restoreResponse.status()}`).toBeTruthy()
            }
        }
    },

    //Snapshot every vet's specialties before the test and restore any changed ones afterwards, even if the test fails
    restoreVetSpecialties: async ({ request }, use) => {
        const originalVetsResponse = await request.get(`${petclinicApiUrl}/vets`)
        expect(originalVetsResponse.ok(), `GET ${originalVetsResponse.url()} returned ${originalVetsResponse.status()}`).toBeTruthy()
        const originalVets: Vet[] = await originalVetsResponse.json()

        await use()

        const currentVetsResponse = await request.get(`${petclinicApiUrl}/vets`)
        const currentVets: Vet[] = await currentVetsResponse.json()
        const specialtyIds = (vet: Vet) => vet.specialties.map(specialty => specialty.id).sort().join(',')
        for (const originalVet of originalVets) {
            const currentVet = currentVets.find(vet => vet.id === originalVet.id)
            if (currentVet && specialtyIds(currentVet) !== specialtyIds(originalVet)) {
                const restoreResponse = await request.put(`${petclinicApiUrl}/vets/${originalVet.id}`, { data: originalVet })
                expect(restoreResponse.ok(), `PUT ${restoreResponse.url()} returned ${restoreResponse.status()}`).toBeTruthy()
            }
        }
    }
})

export { expect }
