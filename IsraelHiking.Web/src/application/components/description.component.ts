import { Component, inject, input, signal, computed, OnChanges, OnDestroy } from "@angular/core";
import { NgClass } from "@angular/common";
import { MatButton } from "@angular/material/button";
import { MatTooltip } from "@angular/material/tooltip";
import { MatProgressSpinner } from "@angular/material/progress-spinner";
import { Store } from "@ngxs/store";

import { AnalyticsDirective } from "../directives/analytics.directive";
import { ResourcesService } from "../services/resources.service";
import { TranslationService } from "../services/translation.service";
import { TextToSpeechService } from "../services/text-to-speech.service";
import type { ApplicationState } from "../models";

@Component({
    selector: "description",
    templateUrl: "description.component.html",
    imports: [NgClass, MatButton, MatTooltip, MatProgressSpinner, AnalyticsDirective]
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
    /** A translation can take seconds, so say that one is on its way rather than changing nothing. */
    public readonly isTranslating = signal(false);
    public readonly showingTranslated = signal(true);
    /** There is nothing to read out loud when the text shown is a placeholder rather than a description. */
    public readonly canReadOutLoud = computed(() => this.textToSpeechService.isSupported &&
        this.feature() != null && this.translationService.getBestDescription(this.feature()) !== "");
    public readonly isReadingOutLoud = computed(() => this.description() !== "" &&
        this.textToSpeechService.speakingText() === this.description());

    public ngOnChanges(): void {
        if (!this.feature()) {
            return;
        }
        // Show the text we already have immediately. A translation takes seconds to come back, and
        // waiting on it would leave the user looking at an empty panel for all of that time.
        this.showToggleTranslation.set(false);
        this.isTranslating.set(false);
        this.description.set(this.getUntranslatedDescription());
        this.fetchTranslationInBackground();
    }

    public ngOnDestroy(): void {
        this.stopReadingOutLoud();
    }

    /**
     * Swaps the translation in once it arrives, if it is still the one being asked for. A translation
     * that never arrives simply leaves the original text on screen, which is better than no text.
     */
    private async fetchTranslationInBackground(): Promise<void> {
        if (!this.showingTranslated() || !this.translationService.isTranslationPossibleAndNeeded(this.feature())) {
            return;
        }
        const feature = this.feature();
        this.isTranslating.set(true);
        let translated: string;
        try {
            translated = await this.translationService.getTranslatedDescription(feature);
        } finally {
            if (this.feature() === feature) {
                this.isTranslating.set(false);
            }
        }
        const isStillRelevant = this.feature() === feature && this.showingTranslated();
        if (!translated || !isStillRelevant || translated === this.translationService.getBestDescription(feature)) {
            return;
        }
        this.description.set(translated);
        this.showToggleTranslation.set(true);
    }

    private getUntranslatedDescription(): string {
        if (!this.feature()) {
            return "";
        }
        const description = this.translationService.getBestDescription(this.feature());
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
        this.description.set(this.getUntranslatedDescription());
        // Going back to the translation is instant, the service caches what it already fetched.
        await this.fetchTranslationInBackground();
    }

    /** Keeps the text from being read out loud after it is gone from the screen or has changed. */
    private stopReadingOutLoud(): void {
        if (this.isReadingOutLoud()) {
            this.textToSpeechService.stop();
        }
    }
}
