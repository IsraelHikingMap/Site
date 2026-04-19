import { Component, inject, input, SimpleChanges, OnInit, OnChanges } from "@angular/core";
import { MatButton } from "@angular/material/button";
import { Store } from "@ngxs/store";

import { Angulartics2OnModule } from "application/directives/gtag.directive";
import { ImageAttribution, ImageAttributionService } from "../services/image-attribution.service";
import { ResourcesService } from "../services/resources.service";
import { SetPublicRoutesFilterAction } from "application/reducers/in-memory.reducer";
import type { ApplicationState, PublicRoutesFilter } from "application/models";

@Component({
    selector: "image-attribution",
    templateUrl: "./image-attribution.component.html",
    imports: [MatButton, Angulartics2OnModule]
})
export class ImageAttributionComponent implements OnInit, OnChanges {

    public imageUrl = input.required<string>();
    public allowFiltering = input<boolean>(false);

    public imageAttribution: ImageAttribution = null;

    public readonly resources = inject(ResourcesService);

    private readonly imageAttributionService = inject(ImageAttributionService);
    private readonly store = inject(Store);

    async ngOnInit(): Promise<void> {
        this.imageAttribution = await this.imageAttributionService.getAttributionForImage(this.imageUrl());
    }

    async ngOnChanges(changes: SimpleChanges<ImageAttributionComponent>): Promise<void> {
        if (changes.imageUrl.currentValue) {
            this.imageAttribution = await this.imageAttributionService.getAttributionForImage(changes.imageUrl.currentValue);
        } else {
            this.imageAttribution = null;
        }
    }

    filterByUserId(userId: string) {
        const filters = structuredClone(this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.publicRoutesFilter)) as PublicRoutesFilter;
        filters.userId = userId;
        this.store.dispatch(new SetPublicRoutesFilterAction(filters));
    }
}