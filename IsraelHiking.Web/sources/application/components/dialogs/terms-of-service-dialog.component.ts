import { Component } from "@angular/core";
import { MdDialogRef } from "@angular/material";

import { BaseMapComponent } from "../base-map.component";
import { ResourcesService } from "../../services/resources.service";
import { OsmUserService } from "../../services/osm-user.service";
import { ToastService } from "../../services/toast.service";

@Component({
    selector: "terms-of-service-dialog",
    templateUrl: "./terms-of-service-dialog.component.html"
})
export class TermsOfServiceDialogComponent extends BaseMapComponent {
    public osmTermsOfServiceUrl: string;
    public wikimediaTermsOfServiceUrl: string;
    public iAgree: boolean;

    constructor(resources: ResourcesService,
        public dialogRef: MdDialogRef<TermsOfServiceDialogComponent>,
        private osmUserService: OsmUserService,
        private toastService: ToastService) {
        super(resources);

        this.iAgree = false;
        this.osmTermsOfServiceUrl = "http://wiki.osmfoundation.org/wiki/Privacy_Policy";
        this.wikimediaTermsOfServiceUrl = `https://wikimediafoundation.org/wiki/Terms_of_Use/${this.resources.getCurrentLanguageCodeSimplified()}`;
    }

    public submit() {
        this.osmUserService.login().then(() => { }, () => {
            this.toastService.warning(this.resources.unableToLogin);
        });
    }
}