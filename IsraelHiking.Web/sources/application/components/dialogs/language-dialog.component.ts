import { Component } from "@angular/core";
import { ResourcesService, LanguageCode } from "../../services/resources.service";
import { BaseMapComponent } from "../base-map.component";

@Component({
    selector: "language-dialog",
    templateUrl: "./language-dialog.component.html"
})
export class LanguageDialogComponent extends BaseMapComponent {
    public selectedLanguageCode: LanguageCode;

    constructor(resources: ResourcesService) {
        super(resources);

        this.selectedLanguageCode = this.resources.currentLanguage.code;
    }

    public saveLanguage() {
        let language = this.resources.availableLanguages.find((l) => l.code === this.selectedLanguageCode);
        this.resources.setLanguage(language);
    }
}