import { Component, inject, input, signal, OnChanges } from "@angular/core";
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

    public readonly description = signal<string>("");
    public readonly showToggleTranslation = signal(false);
    public readonly showingTranslated = signal(true);

    public async ngOnChanges(): Promise<void> {
        if (!this.feature()) {
            return;
        }
        this.description.set(await this.getDescription());
        this.showToggleTranslation.set(this.translationService.isTranslationPossibleAndNeeded(this.feature()) &&
            this.description() !== this.translationService.getBestDescription(this.feature()));
    }

    private async getDescription(): Promise<string> {
        if (!this.feature()) {
            return "";
        }
        const originalDescription = this.translationService.getBestDescription(this.feature());
        const shouldTranslate = this.showingTranslated() && this.translationService.isTranslationPossibleAndNeeded(this.feature());
        // A translation that could not be fetched falls back to the original text, it is better than no text at all
        const description = shouldTranslate
            ? await this.translationService.getTranslatedDescription(this.feature()) || originalDescription
            : originalDescription;

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
        this.showingTranslated.set(!this.showingTranslated());
        this.description.set(await this.getDescription());
    }
}