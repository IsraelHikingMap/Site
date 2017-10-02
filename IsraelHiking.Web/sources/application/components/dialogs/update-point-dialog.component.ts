import { Component } from "@angular/core";
import { Http } from "@angular/http";
import { MdDialogRef, MdSelectChange } from "@angular/material";
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
    templateUrl: "./update-point-dialog.component.html"
})
export class UpdatePointDialogComponent extends BaseMapComponent {
    public categories: ICategoryWithIcons[];
    public source: string;
    public title: string;
    public description: string;
    public imageUrl: string;
    public websiteUrl: string;
    public identifier: string;
    public elementType: string;
    public location: L.LatLng;
    public selectedCategory: ICategoryWithIcons;
    public icons: IIconColorLabel[];
    public initializationPromise: Promise<any>;

    constructor(resources: ResourcesService,
        public dialogRef: MdDialogRef<UpdatePointDialogComponent>,
        private http: Http,
        private fileService: FileService,
        private toastService: ToastService,
        private poiService: PoiService,
        private osmUserService: OsmUserService) {
        super(resources);
        this.categories = [];
        this.initializationPromise = new Promise((resolve, reject) => {
            this.poiService.getCategories("Points of Interest").then((response) => {
                for (let categoryType in response) {
                    if (!response.hasOwnProperty(categoryType))
                        continue;
                    this.categories.push({
                        key: categoryType,
                        isSelected: false,
                        label: this.resources.translate(categoryType),
                        icon: response[categoryType][0].icon,
                        color: response[categoryType][0].color,
                        icons: response[categoryType].map(i => {
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
                resolve();
            }, () => {
                reject();
            });
        });

    }

    public selectCategory(e: MdSelectChange) {
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

    public uploadImage(e: any) {
        let file = e.dataTransfer ? e.dataTransfer.files[0] : e.target.files[0];
        if (!file) {
            return;
        }
        this.fileService.uploadImage(file, this.title, this.location).then((imageUrl: string) => {
            this.imageUrl = imageUrl;
        }, () => {
            this.toastService.error(this.resources.unableToUploadFile);
        });
    }

    public updatePoint() {
        let poiExtended = {
            description: this.description,
            icon: this.selectedCategory.selectedIcon.icon,
            iconColor: this.selectedCategory.selectedIcon.color,
            id: this.identifier,
            imagesUrls: [this.imageUrl],
            title: this.title,
            url: this.websiteUrl,
            source: this.source,
            location: this.location
        } as IPointOfInterestExtended;
        this.poiService.uploadPoint(poiExtended).then((response) => {
            this.toastService.info(this.resources.dataUpdatedSuccefully);
            this.dialogRef.close(response.json());
        }, () => {
            this.dialogRef.close(null);
        });
    }

    public getEditElementOsmAddress(): string {
        return this.osmUserService.getEditElementOsmAddress("", this.elementType, this.identifier);
    }
}