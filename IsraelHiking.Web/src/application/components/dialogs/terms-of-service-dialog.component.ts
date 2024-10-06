import { Component, inject } from "@angular/core";

import { ResourcesService } from "../../services/resources.service";
import { AuthorizationService } from "../../services/authorization.service";
import { ToastService } from "../../services/toast.service";

@Component({
    selector: "terms-of-service-dialog",
    templateUrl: "./terms-of-service-dialog.component.html"
})
export class TermsOfServiceDialogComponent {
    public wikimediaTermsOfServiceUrl: string;
    public iAgree: boolean = false;

    public readonly resources = inject(ResourcesService);

    private readonly authorizationService = inject(AuthorizationService);
    private readonly toastService = inject(ToastService);

    constructor() {

        this.wikimediaTermsOfServiceUrl =
            `https://wikimediafoundation.org/wiki/Terms_of_Use/${this.resources.getCurrentLanguageCodeSimplified()}`;
    }

    public submit() {
        this.authorizationService.login().then(() => { }, () => {
            this.toastService.warning(this.resources.unableToLogin);
        });
    }
}
