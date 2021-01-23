import { Component } from "@angular/core";

import { BaseMapComponent } from "../base-map.component";
import { ResourcesService } from "../../services/resources.service";
import { ApplicationState, Language, LanguageCode } from "../../models/models";
import { NgRedux } from "@angular-redux/store";

@Component({
    selector: "language-dialog",
    templateUrl: "./language-dialog.component.html"
})
export class LanguageDialogComponent extends BaseMapComponent {
    public selectedLanguageCode: LanguageCode;
    public availableLanguages: Language[];

    constructor(resources: ResourcesService,
                private readonly ngRedux: NgRedux<ApplicationState>) {
        super(resources);
        this.availableLanguages = [
            {
                code: "he",
                rtl: true,
            },
            {
                code: "en-US",
                rtl: false,
            }
        ];
        this.selectedLanguageCode = this.ngRedux.getState().configuration.language.code;
    }

    public saveLanguage() {
        let language = this.availableLanguages.find((l) => l.code === this.selectedLanguageCode);
        this.resources.setLanguage(language);
    }

    public getLabel(code: LanguageCode) {
        code === "he" ? "עברית" : "English"
    }
}
