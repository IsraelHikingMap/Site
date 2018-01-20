import { Component, ViewEncapsulation } from "@angular/core";
import { MatDialogRef, MatSelectChange } from "@angular/material";
import * as _ from "lodash";

import { BaseMapComponent } from "../base-map.component";
import { ResourcesService } from "../../services/resources.service";
import { FileService } from "../../services/file.service";
import { PoiService, IPointOfInterestExtended, ICategory, IIconColorLabel } from "../../services/poi.service";
import { ToastService } from "../../services/toast.service";
import { OsmUserService } from "../../services/osm-user.service";

export interface ICategoryWithIcons extends ICategory {
    icons: IIconColorLabel[];
    selectedIcon: IIconColorLabel;
}

@Component({
    selector: "update-point-dialog",
    templateUrl: "./update-point-dialog.component.html",
    styleUrls: ["./update-point-dialog.component.css"],
    encapsulation: ViewEncapsulation.None
})
export class UpdatePointDialogComponent extends BaseMapComponent {
    public categories: ICategoryWithIcons[];
    public source: string;
    public title: string;
    public description: string;
    public imagesUrls: string[];
    public websiteUrl: string;
    public identifier: string;
    public elementType: string;
    public location: L.LatLng;
    public selectedCategory: ICategoryWithIcons;
    public icons: IIconColorLabel[];
    public uploading: boolean;
    private currentImageIndex: number;
    private currentImageFiles: File[];

    constructor(resources: ResourcesService,
        public dialogRef: MatDialogRef<UpdatePointDialogComponent>,
        private fileService: FileService,
        private toastService: ToastService,
        private poiService: PoiService,
        private osmUserService: OsmUserService) {
        super(resources);
        this.categories = [];
        this.currentImageIndex = 0;
        this.imagesUrls = [];
        this.currentImageFiles = [];
        this.uploading = false;
    }

    public async initialize(markerIcon: string) {
        let dictionary = await this.poiService.getCategories("Points of Interest");
        for (let categoryType in dictionary) {
            if (!dictionary.hasOwnProperty(categoryType)) {
                continue;
            }
            this.categories.push({
                key: categoryType,
                isSelected: false,
                label: this.resources.translate(categoryType),
                icon: dictionary[categoryType][0].icon,
                color: dictionary[categoryType][0].color,
                icons: dictionary[categoryType].map(i => {
                    return {
                        color: i.color,
                        icon: i.icon,
                        label: this.resources.translate(i.label)
                    } as IIconColorLabel;
                })
            } as ICategoryWithIcons);
        }
        this.selectedCategory = this.categories[0];
        this.categories[0].selectedIcon = this.categories[0].icons[0];

        for (let category of this.categories) {
            let icon = _.find(category.icons, iconToFind => iconToFind.icon === markerIcon);
            if (icon) {
                this.selectCategory({ value: category } as MatSelectChange);
                this.selectIcon(icon);
            }
        }
    }

    public selectCategory(e: MatSelectChange) {
        this.categories.forEach(c => c.isSelected = false);
        this.selectedCategory = e.value;
        this.selectedCategory.isSelected = true;
        if (this.selectedCategory.selectedIcon == null) {
            this.selectedCategory.selectedIcon = this.selectedCategory.icons[0];
        }
    }

    private getCategory(categoryKey: string): ICategoryWithIcons {
        return _.find(this.categories, categoryToFind => categoryToFind.key === categoryKey);
    }

    public selectIcon(icon: IIconColorLabel) {
        this.selectedCategory.selectedIcon = icon;
    }

    public imageChanged(e: any) {
        let files = this.fileService.getFilesFromEvent(e);
        for (let file of files) {
            this.currentImageFiles.push(file);
            let reader = new FileReader();

            reader.onload = (event: any) => {
                this.imagesUrls.push(event.target.result);
                this.currentImageIndex = this.imagesUrls.length - 1;
            }

            reader.readAsDataURL(file);    
        }
    }

    public async uploadPoint() {
        this.uploading = true;
        let imageUrls = _.dropRight(this.imagesUrls, this.currentImageFiles.length);

        let poiExtended = {
            description: this.description,
            icon: this.selectedCategory.selectedIcon.icon,
            iconColor: this.selectedCategory.selectedIcon.color,
            id: this.identifier,
            imagesUrls: imageUrls,
            title: this.title,
            url: this.websiteUrl,
            source: this.source,
            type: this.elementType,
            location: this.location
        } as IPointOfInterestExtended;
        try {
            let poi = await this.poiService.uploadPoint(poiExtended, this.currentImageFiles);
            this.toastService.info(this.resources.dataUpdatedSuccefully);
            this.dialogRef.close(poi);
        } catch (ex) {
            this.toastService.error(this.resources.unableToSaveData);
            this.dialogRef.close(null);
        } finally {
            this.uploading = false;
        };
    }

    public getEditElementOsmAddress(): string {
        return this.osmUserService.getEditElementOsmAddress("", this.elementType, this.identifier);
    }

    public getCurrentImage() {
        if (this.imagesUrls.length === 0) {
            return null;
        }
        return this.resources.getResizedImageUrl(this.imagesUrls[this.currentImageIndex], 800);
    }

    public nextImage() {
        this.currentImageIndex++;
        if (this.currentImageIndex >= this.imagesUrls.length) {
            this.currentImageIndex = this.imagesUrls.length - 1;
        }
    }

    public previousImage() {
        this.currentImageIndex--;
        if (this.currentImageIndex < 0) {
            this.currentImageIndex = 0;
        }
    }

    public disableChangeImage(type: string) {
        switch (type) {
            case "previous":
                return this.currentImageIndex <= 0;
            case "next":
                return this.currentImageIndex >= this.imagesUrls.length - 1;
        }
        return false;
    }

    public canUpload() {
        return (this.title || this.description || this.imagesUrls.length !== 0) &&
            !this.uploading;
    }
}