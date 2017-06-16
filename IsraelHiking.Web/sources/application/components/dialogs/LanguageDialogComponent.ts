import { Component } from "@angular/core";
import { MdDialog } from "@angular/material";
import { ResourcesService, LanguageCode } from "../../services/ResourcesService";
import { BaseMapComponent } from "../BaseMapComponent";

@Component({
    selector: "language-dialog",
    templateUrl: "./languageDialog.html"
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