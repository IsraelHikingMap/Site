import { Component, inject, input, SimpleChanges, OnInit, OnChanges } from "@angular/core";
import { ImageAttribution, ImageAttributionService } from "../services/image-attribution.service";
import { ResourcesService } from "../services/resources.service";

@Component({
    selector: "image-attribution",
    templateUrl: "./image-attribution.component.html"
})
export class ImageAttributionComponent implements OnInit, OnChanges {

    public imageUrl = input.required<string>();

    public imageAttribution: ImageAttribution = null;

    public readonly resources = inject(ResourcesService);

    private readonly imageAttributionService = inject(ImageAttributionService);

    async ngOnInit(): Promise<void> {
        this.imageAttribution = await this.imageAttributionService.getAttributionForImage(this.imageUrl());
    }

    async ngOnChanges(changes: SimpleChanges<ImageAttributionComponent>): Promise<void> {
        console.log(changes.imageUrl.currentValue);
        if (changes.imageUrl.currentValue) {
            this.imageAttribution = await this.imageAttributionService.getAttributionForImage(changes.imageUrl.currentValue);
            console.log(this.imageAttribution, "for value", changes.imageUrl.currentValue);
        } else {
            this.imageAttribution = null;
        }
        console.log(this.imageAttribution);
    }
}