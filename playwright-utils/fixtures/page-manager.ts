import type { Page } from '@playwright/test'
import { PetTypesPage } from "../pages/pet-types-page";
import { EditPetTypePage } from "../pages/edit-pet-type-page";
import { HeaderComponent } from '../pages/header-component';

export class PageManager {

    readonly headerComponent: HeaderComponent
    readonly petTypesPage: PetTypesPage
    readonly editPetTypePage: EditPetTypePage

    constructor(page: Page) {
        this.headerComponent = new HeaderComponent(page)
        this.petTypesPage = new PetTypesPage(page)
        this.editPetTypePage = new EditPetTypePage(page)
    }
}