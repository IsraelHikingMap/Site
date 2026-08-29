import { afterNextRender, Component, inject, signal } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { Dir } from "@angular/cdk/bidi";
import { MatButton, MatAnchor } from "@angular/material/button";
import { MatFormField, MatLabel } from "@angular/material/input";
import { MatRadioGroup, MatRadioButton } from "@angular/material/radio";
import { MatCheckbox } from "@angular/material/checkbox";
import { FormsModule } from "@angular/forms";
import { MatOption, MatSelect } from "@angular/material/select";
import { Store } from "@ngxs/store";

import { AnalyticsDirective } from "../../directives/analytics.directive";
import { ScrollToDirective } from "../../directives/scroll-to.directive";
import { ResourcesService } from "../../services/resources.service";
import { RunningContextService } from "../../services/running-context.service";
import { ToastService } from "../../services/toast.service";
import { LoggingService } from "../../services/logging.service";
import { DatabaseService } from "../../services/database.service";
import { RouteStrings } from "../../services/hash.service";
import {
    SetBatteryOptimizationTypeAction,
    SetDateFormatAction,
    SetThemeAction,
    SetUnitsAction,
    ToggleAutomaticRecordingUploadAction,
    ToggleGotLostWarningsAction
} from "../../reducers/configuration.reducer";
import type { ApplicationState, BatteryOptimizationType, ThemeSetting } from "../../models";

@Component({
    selector: "settings",
    templateUrl: "./settings.component.html",
    imports: [Dir, MatButton, MatRadioGroup, MatRadioButton, AnalyticsDirective, MatCheckbox, MatAnchor, FormsModule, MatFormField, MatSelect, MatOption, MatLabel]
})
export class SettingsComponent {

    public readonly clearDataElementId = "clear-data";

    public readonly manageSubscriptions: string;
    public readonly username: string;
    public readonly isClearDataHighlighted = signal(false);

    public readonly resources = inject(ResourcesService);

    private readonly runningContextService = inject(RunningContextService);
    private readonly toastService = inject(ToastService);
    private readonly loggingService = inject(LoggingService);
    private readonly databaseService = inject(DatabaseService);
    private readonly activatedRoute = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly store = inject(Store);

    public isLoggedIn = this.store.selectSignal((state: ApplicationState) => state.userState.userInfo !== null);
    public units = this.store.selectSignal((state: ApplicationState) => state.configuration.units);
    public theme = this.store.selectSignal((state: ApplicationState) => state.configuration.theme);
    public dateFormat = this.store.selectSignal((state: ApplicationState) => state.configuration.dateFormat);
    public isAutomaticRecordingUpload = this.store.selectSignal((state: ApplicationState) => state.configuration.isAutomaticRecordingUpload);
    public isGotLostWarnings = this.store.selectSignal((state: ApplicationState) => state.configuration.isGotLostWarnings);
    public batteryOptimizationType = this.store.selectSignal((state: ApplicationState) => state.configuration.batteryOptimizationType);
    public isSubscribed = this.store.selectSignal((state: ApplicationState) => state.offlineState.isSubscribed);

    constructor() {
        this.manageSubscriptions = this.runningContextService.isIos
            ? "https://apps.apple.com/account/subscriptions"
            : "https://play.google.com/store/account/subscriptions";
        this.username = this.store.selectSnapshot((state: ApplicationState) => state.userState.userInfo)?.displayName;
        this.isClearDataHighlighted.set(
            this.activatedRoute.snapshot.queryParamMap.get(RouteStrings.HIGHLIGHT) === "clear-data");
        afterNextRender(() => this.scrollToClearDataIfHighlighted());
    }

    /**
     * Brings the highlighted button into view, since it sits at the bottom of the screen and a
     * highlight is of no use to a user who does not see it.
     */
    private scrollToClearDataIfHighlighted() {
        if (!this.isClearDataHighlighted()) {
            return;
        }
        ScrollToDirective.scrollTo(this.clearDataElementId);
    }

    public isApp() {
        return this.runningContextService.isCapacitor;
    }

    public setUnits(units: "metric" | "imperial") {
        this.store.dispatch(new SetUnitsAction(units));
    }

    public setTheme(theme: ThemeSetting) {
        this.store.dispatch(new SetThemeAction(theme));
    }

    public toggleAutomaticRecordingUpload() {
        this.store.dispatch(new ToggleAutomaticRecordingUploadAction());
    }

    public setBatteryOptimizationType(batteryOptimizationType: BatteryOptimizationType) {
        this.store.dispatch(new SetBatteryOptimizationTypeAction(batteryOptimizationType));
    }

    public toggleGotLostWarnings() {
        this.store.dispatch(new ToggleGotLostWarningsAction());
    }

    public clearData() {
        this.toastService.confirm({
            type: "YesNo",
            message: this.resources.areYouSure,
            confirmAction: async () => {
                this.loggingService.info("************** RESET DATA WAS PRESSED **************");
                await this.databaseService.deleteAllData();
                if (this.runningContextService.isCapacitor) {
                    this.router.navigate([RouteStrings.ROUTE_MAP]);
                } else {
                    window.location.assign(RouteStrings.ROUTE_MAP);
                }
            }
        });
    }

    public setDateFormat(dateFormat: string) {
        if (!dateFormat) {
            return;
        }
        this.store.dispatch(new SetDateFormatAction(dateFormat.replaceAll("Y", "y").replaceAll("D", "d")));
    }
}
