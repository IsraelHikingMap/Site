import { Component, inject } from "@angular/core";
import { Dir } from "@angular/cdk/bidi";
import { MatButton } from "@angular/material/button";
import { MatDialog, MatDialogConfig, MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose } from "@angular/material/dialog";
import { Store } from "@ngxs/store";

import { AnalyticsDirective } from "../../directives/analytics.directive";
import { ResourcesService } from "../../services/resources.service";
import { StopShowingOnboardingAction } from "../../reducers/configuration.reducer";
import { RunningContextService } from "../../services/running-context.service";

/**
 * A one time notice about what the app does with the user's data, with a link to the full policy.
 * It is dismissed for good on the first acknowledgement, see `isShowOnboarding`.
 *
 * @remarks
 * Anchored to the bottom without a backdrop, the same way {@link UseAppDialogComponent} is, so that
 * it reads as a banner without blocking the map behind it. Which of the two is shown, and when, is
 * decided in ApplicationInitializeService - they both sit at the bottom of the screen and would
 * cover each other if they were ever opened together.
 */
@Component({
    selector: "privacy-dialog",
    templateUrl: "./privacy-dialog.component.html",
    imports: [Dir, MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose, MatButton, AnalyticsDirective]
})
export class PrivacyDialogComponent {

    public readonly resources = inject(ResourcesService);

    private readonly store = inject(Store);

    private static readonly DESKTOP_MARGIN = "16px";

    /**
     * A full width bar at the bottom on a phone, and a card in the bottom corner the language
     * starts from on a wide screen, so that it does not sit on top of the middle of the map.
     */
    public static openDialog(dialog: MatDialog, runningContextService: RunningContextService, resources: ResourcesService) {
        const options: MatDialogConfig = {
            hasBackdrop: false,
            // Acknowledging the notice is the only way out of it, so escape must not dismiss it
            // either - that would leave it unacknowledged and bring it back on the next visit.
            disableClose: true,
            position: {
                bottom: "0px"
            }
        };
        if (runningContextService.isMobile) {
            options.maxWidth = "100vw";
            options.width = "100%";
        } else {
            options.width = "480px";
            options.position.bottom = PrivacyDialogComponent.DESKTOP_MARGIN;
            if (resources.direction === "rtl") {
                options.position.right = PrivacyDialogComponent.DESKTOP_MARGIN;
            } else {
                options.position.left = PrivacyDialogComponent.DESKTOP_MARGIN;
            }
        }
        dialog.open(PrivacyDialogComponent, options);
    }

    public close() {
        this.store.dispatch(new StopShowingOnboardingAction());
    }
}
