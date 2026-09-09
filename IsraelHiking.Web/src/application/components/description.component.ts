import { Component, inject, input, signal, computed, OnChanges, OnDestroy } from "@angular/core";
import { NgClass } from "@angular/common";
import { MatButton } from "@angular/material/button";
import { MatTooltip } from "@angular/material/tooltip";
import { Store } from "@ngxs/store";

import { AnalyticsDirective } from "../directives/analytics.directive";
import { ResourcesService } from "../services/resources.service";
import { TranslationService } from "../services/translation.service";
import { TextToSpeechService } from "../services/text-to-speech.service";
import type { ApplicationState } from "../models";

@Component({
    selector: "description",
    templateUrl: "description.component.html",
    imports: [NgClass, MatButton, MatTooltip, AnalyticsDirective]
})
export class DescriptionComponent implements OnChanges, OnDestroy {

    public readonly feature = input<GeoJSON.Feature>();
    public readonly isEditable = input<boolean>(false);

    public readonly resources = inject(ResourcesService);
    public readonly textToSpeechService = inject(TextToSpeechService);

    private readonly translationService = inject(TranslationService);
    private readonly store = inject(Store);

    public readonly description = signal<string>("");
    public readonly showToggleTranslation = signal(false);
    public readonly showingTranslated = signal(true);
    /** There is nothing to read out loud when the text shown is a placeholder rather than a description. */
    public readonly canReadOutLoud = computed(() => this.textToSpeechService.isSupported &&
        this.feature() != null && this.translationService.getBestDescription(this.feature()) !== "");
    public readonly isReadingOutLoud = computed(() => this.description() !== "" &&
        this.textToSpeechService.speakingText() === this.description());

    public async ngOnChanges(): Promise<void> {
        if (!this.feature()) {
            return;
        }
        this.description.set(await this.getDescription());
        this.showToggleTranslation.set(this.translationService.isTranslationPossibleAndNeeded(this.feature()) &&
            this.description() !== this.translationService.getBestDescription(this.feature()));
    }

    public ngOnDestroy(): void {
        this.stopReadingOutLoud();
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

    public toggleReadOutLoud(): void {
        if (this.isReadingOutLoud()) {
            this.stopReadingOutLoud();
        } else {
            this.textToSpeechService.speak(this.description());
        }
    }

    public async toggleTranslation(): Promise<void> {
        this.stopReadingOutLoud();
        this.showingTranslated.set(!this.showingTranslated());
        this.description.set(await this.getDescription());
    }

    /** Keeps the text from being read out loud after it is gone from the screen or has changed. */
    private stopReadingOutLoud(): void {
        if (this.isReadingOutLoud()) {
            this.textToSpeechService.stop();
        }
    }
}
