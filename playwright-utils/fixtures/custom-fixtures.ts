import { test as base, expect } from '@playwright/test'
import { PageManager } from './page-manager'
import { petclinicApiUrl } from '../helpers/api-urls'

export type TestOptions = {
    pom: PageManager
    restorePetTypes: void
}

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
    }
})

export { expect }
