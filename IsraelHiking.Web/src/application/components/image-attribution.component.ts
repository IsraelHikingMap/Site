import { Component, inject, input, signal, SimpleChanges, OnInit, OnChanges } from "@angular/core";
import { MatButton } from "@angular/material/button";
import { Store } from "@ngxs/store";

import { AnalyticsDirective } from "../directives/analytics.directive";
import { ImageAttribution, ImageAttributionService } from "../services/image-attribution.service";
import { ResourcesService } from "../services/resources.service";
import { SetPublicRoutesFilterAction } from "../reducers/in-memory.reducer";
import type { ApplicationState, PublicRoutesFilter } from "../models";

@Component({
    selector: "image-attribution",
    templateUrl: "./image-attribution.component.html",
    imports: [MatButton, AnalyticsDirective]
})
export class ImageAttributionComponent implements OnInit, OnChanges {

    public readonly imageUrl = input.required<string>();
    public readonly allowFiltering = input<boolean>(false);

    public readonly imageAttribution = signal<ImageAttribution>(null);

    public readonly resources = inject(ResourcesService);

    private readonly imageAttributionService = inject(ImageAttributionService);
    private readonly store = inject(Store);

    async ngOnInit(): Promise<void> {
        this.imageAttribution.set(await this.imageAttributionService.getAttributionForImage(this.imageUrl()));
    }

    async ngOnChanges(changes: SimpleChanges<ImageAttributionComponent>): Promise<void> {
        if (changes.imageUrl.currentValue) {
            this.imageAttribution.set(await this.imageAttributionService.getAttributionForImage(changes.imageUrl.currentValue));
        } else {
            this.imageAttribution.set(null);
        }
    }

    filterByUserId(userId: string) {
        const filters = structuredClone(this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.publicRoutesFilter)) as PublicRoutesFilter;
        filters.userId = userId;
        this.store.dispatch(new SetPublicRoutesFilterAction(filters));
    }
}