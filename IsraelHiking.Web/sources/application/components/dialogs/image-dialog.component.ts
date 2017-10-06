import { Component, ViewChildren, ElementRef, AfterViewInit, QueryList } from "@angular/core";
import { GestureConfig } from "@angular/material"
import { BaseMapComponent } from "../base-map.component";
import { ResourcesService } from "../../services/resources.service";

@Component({
    selector: "image-dialog",
    templateUrl: "./image-dialog.component.html",
    styleUrls: ["./image-dialog.component.css"]
})
export class ImageDialogCompnent extends BaseMapComponent implements AfterViewInit {

    public title: string;
    public imagesUrls: string[];
    private selectedTabIndex: number;

    @ViewChildren("imageContainer")
    public imagesElementRef: QueryList<ElementRef>;

    constructor(resources: ResourcesService,
        private readonly gestureConfig: GestureConfig) {
        super(resources);
        this.selectedTabIndex = 0;
    }

    public ngAfterViewInit(): void {
        // add swipe support for multimple images
        this.imagesElementRef.forEach(e => {
            let hammer = this.gestureConfig.buildHammer(e.nativeElement);
            hammer.on(`swipe${this.resources.start}`, () => {
                this.selectedTabIndex++;
                if (this.selectedTabIndex >= this.imagesUrls.length) {
                    this.selectedTabIndex = this.imagesUrls.length - 1;
                }
            });
            hammer.on(`swipe${this.resources.end}`, () => {
                this.selectedTabIndex--;
                if (this.selectedTabIndex < 0) {
                    this.selectedTabIndex = 0;
                }
            });
            
        });
    }
}