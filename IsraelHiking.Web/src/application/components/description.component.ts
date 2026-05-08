import { Component, inject, input, OnChanges } from "@angular/core";
import { NgClass } from "@angular/common";
import { Store } from "@ngxs/store";

import { ResourcesService } from "../services/resources.service";
import { TranslationService } from "../services/translation.service";
import type { ApplicationState } from "../models";

@Component({
    selector: "description",
    templateUrl: "description.component.html",
    imports: [NgClass]
})
export class DescriptionComponent implements OnChanges {

    public readonly feature = input<GeoJSON.Feature>();
    public readonly isEditable = input<boolean>(false);

    public readonly resources = inject(ResourcesService);

    private readonly translationService = inject(TranslationService);
    private readonly store = inject(Store);

    public description: string;
    public showToggleTranslation = false;
    public showingTranslated = true;

    public async ngOnChanges(): Promise<void> {
        if (!this.feature()) {
            return;
        }
        this.description = await this.getDescription();
        this.showToggleTranslation = this.translationService.isTranslationPossibleAndNeeded(this.feature()) &&
            this.description !== this.translationService.getBestDescription(this.feature());
    }

    private async getDescription(): Promise<string> {
        if (!this.feature()) {
            return "";
        }
        const description = this.showingTranslated && this.translationService.isTranslationPossibleAndNeeded(this.feature())
            ? await this.translationService.getTranslatedDescription(this.feature())
            : this.translationService.getBestDescription(this.feature());

        if (description) {
            return description;
        }
        if (!this.isEditable()) {
            return this.resources.noDescriptionAvailableInYourLanguage;
        }
        const isLoggedOut = this.store.selectSnapshot((state: ApplicationState) => state.userState.userInfo) == null;
        if (isLoggedOut) {
            return this.resources.noDescriptionLoginRequired;
        }
        return this.resources.emptyPoiDescription;
    }

    public async toggleTranslation(): Promise<void> {
        this.showingTranslated = !this.showingTranslated;
        this.description = await this.getDescription();
    }
}