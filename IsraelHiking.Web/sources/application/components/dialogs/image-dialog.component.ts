import { Component } from "@angular/core";
import {BaseMapComponent} from "../base-map.component";
import {ResourcesService} from "../../services/resources.service";

@Component({
    selector: "image-dialog",
    templateUrl: "./image-dialog.component.html",
    styleUrls: ["./image-dialog.component.css"]
})
export class ImageDialogCompnent extends BaseMapComponent {
    public title: string;
    public imageUrl: string;

    constructor(resources: ResourcesService) {
        super(resources);
    }
}