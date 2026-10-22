import type { Page } from '@playwright/test'
import { PetTypesPage } from "../pages/pet-types-page";
import { EditPetTypePage } from "../pages/edit-pet-type-page";
import { HeaderComponent } from '../pages/header-component';
import { VeterinariansPage } from '../pages/veterinarians-page';
import { EditVeterinarianPage } from '../pages/edit-veterinarians-page';

export class PageManager {

    readonly headerComponent: HeaderComponent
    readonly petTypesPage: PetTypesPage
    readonly editPetTypePage: EditPetTypePage
    readonly veterinariansPage: VeterinariansPage
    readonly editVeterinarianPage: EditVeterinarianPage

    constructor(page: Page) {
        this.headerComponent = new HeaderComponent(page)
        this.petTypesPage = new PetTypesPage(page)
        this.editPetTypePage = new EditPetTypePage(page)
        this.veterinariansPage = new VeterinariansPage(page)
        this.editVeterinarianPage = new EditVeterinarianPage(page)
    }
}
