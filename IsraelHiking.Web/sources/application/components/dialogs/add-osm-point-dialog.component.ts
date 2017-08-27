import { Component } from "@angular/core";

import { BaseMapComponent } from "../base-map.component";
import { ResourcesService } from "../../services/resources.service";
import { FileService } from "../../services/file.service";
import { ToastService } from "../../services/toast.service";

export interface ICategory {
    icon: string;
    color: string;
    label: string;
}

export interface ICategoriesGroup {
    categories: ICategory[];
}

@Component({
    selector: "add-osm-point-dialog",
    templateUrl: "./add-osm-point-dialog.component.html"
})
export class AddOsmPointDialogComponent extends BaseMapComponent {
    public categoriesTypeGroups: ICategoriesGroup[];
    public title: string;
    public description: string;
    public imageUrl: string;
    public selectedCategory: ICategory;

    constructor(resources: ResourcesService,
        private fileService: FileService,
        private toastService: ToastService) {
        super(resources);
        this.categoriesTypeGroups = [
            {
                categories: [
                    {
                        icon: "viewpoint",
                        color: "black",
                        label: this.resources.legendViewpoint
                    }, {
                        icon: "tint",
                        color: "blue",
                        label: this.resources.spring
                    }, {
                        icon: "ruins",
                        color: "brown",
                        label: this.resources.legendRuins
                    }
                ]
            },
            {
                categories: [
                    {
                        icon: "picnic",
                        color: "brown",
                        label: this.resources.legendPicnicArea
                    },
                    {
                        icon: "campsite",
                        color: "grey",
                        label: this.resources.legendCampsite
                    },
                    {
                        icon: "tree",
                        color: "green",
                        label: this.resources.legendTree
                    }
                ]
            },
            {
                categories: [
                    {
                        icon: "cave",
                        color: "black",
                        label: this.resources.legendCave
                    },
                    {
                        icon: "star",
                        color: "orange",
                        label: this.resources.legendAttraction
                    },
                    {
                        icon: "peak",
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

    public addPoint() {
        // HM TODO: send to server;
    }
}