import { Component } from "@angular/core";
import { MatDialogRef } from "@angular/material/dialog";

import { BaseMapComponent } from "../base-map.component";
import { ResourcesService } from "../../services/resources.service";
import { AuthorizationService } from "../../services/authorization.service";
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
                public dialogRef: MatDialogRef<TermsOfServiceDialogComponent>,
                private authorizationService: AuthorizationService,
                private toastService: ToastService) {
        super(resources);

        this.iAgree = false;
        this.osmTermsOfServiceUrl = "https://wiki.osmfoundation.org/wiki/Privacy_Policy";
        this.wikimediaTermsOfServiceUrl =
            `https://wikimediafoundation.org/wiki/Terms_of_Use/${this.resources.getCurrentLanguageCodeSimplified()}`;
        this.imgurTermsOfServiceUrl = "https://imgur.com/tos";
    }

    public submit() {
        this.authorizationService.login().then(() => { }, () => {
            this.toastService.warning(this.resources.unableToLogin);
        });
    }
}
