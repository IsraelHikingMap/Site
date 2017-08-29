import { Component } from "@angular/core";
import { Http } from "@angular/http";

import { BaseMapComponent } from "../base-map.component";
import { ResourcesService } from "../../services/resources.service";
import { FileService } from "../../services/file.service";
import { PoiService, IPointOfInterestExtended } from "../../services/poi.service";
import { ToastService } from "../../services/toast.service";
import { Urls } from "../../common/Urls";



export interface ICategory {
    icon: string;
    color: string;
    label: string;
}

export interface ICategoriesGroup {
    categories: ICategory[];
}

@Component({
    selector: "update-point-dialog",
    templateUrl: "./update-point-dialog.component.html"
})
export class UpdatePointDialogComponent extends BaseMapComponent {
    public categoriesTypeGroups: ICategoriesGroup[];
    public source: string;
    public title: string;
    public description: string;
    public imageUrl: string;
    public websiteUrl: string;
    public identifier: string;
    public location: L.LatLng;
    public selectedCategory: ICategory;

    constructor(resources: ResourcesService,
        private http: Http,
        private fileService: FileService,
        private toastService: ToastService,
        private poiService: PoiService) {
        super(resources);
        this.categoriesTypeGroups = [
            {
                categories: [
                    {
                        icon: "icon-viewpoint",
                        color: "black",
                        label: this.resources.legendViewpoint
                    }, {
                        icon: "icon-tint",
                        color: "blue",
                        label: this.resources.spring
                    }, {
                        icon: "icon-ruins",
                        color: "brown",
                        label: this.resources.legendRuins
                    }
                ]
            },
            {
                categories: [
                    {
                        icon: "icon-picnic",
                        color: "brown",
                        label: this.resources.legendPicnicArea
                    },
                    {
                        icon: "icon-campsite",
                        color: "grey",
                        label: this.resources.legendCampsite
                    },
                    {
                        icon: "icon-tree",
                        color: "green",
                        label: this.resources.legendTree
                    }
                ]
            },
            {
                categories: [
                    {
                        icon: "icon-cave",
                        color: "black",
                        label: this.resources.legendCave
                    },
                    {
                        icon: "icon-star",
                        color: "orange",
                        label: this.resources.legendAttraction
                    },
                    {
                        icon: "icon-peak",
                        color: "black",
                        label: this.resources.legendPeak
                    }
                ]
            }
        ];
        this.selectedCategory = this.categoriesTypeGroups[0].categories[0];
    }

    public selectCategory(category: ICategory) {
        this.selectedCategory = category;
    }

    public uploadImage(e: any) {
        let file = e.dataTransfer ? e.dataTransfer.files[0] : e.target.files[0];
        if (!file) {
            return;
        }
        this.fileService.uploadImage(file).then((link: string) => {
            this.imageUrl = link;
        }, () => {
            this.toastService.error(this.resources.unableToUploadFile);
        });
    }

    public updatePoint() {
        let poiExtended = {
            description: this.description,
            icon: this.selectedCategory.icon,
            iconColor: this.selectedCategory.color,
            id: this.identifier,
            imageUrl: this.imageUrl,
            title: this.title,
            url: this.websiteUrl,
            source: this.source,
            location: this.location
        } as IPointOfInterestExtended;
        this.poiService.uploadPoint(poiExtended).then(() => {
            this.toastService.info(this.resources.dataUpdatedSuccefully);
        });
    }
}