import { Injectable } from "@angular/core";
import { AppUpdate, AppUpdateAvailability } from '@capawesome/capacitor-app-update';

import { RunningContextService } from "./running-context.service";
import { ToastService } from "./toast.service";
import { ResourcesService } from "./resources.service";

@Injectable()
export class ApplicationUpdateService {
    constructor(private readonly resourcesService: ResourcesService,
        private readonly runningContextSerive: RunningContextService,
        private readonly toastService: ToastService) {}

    public async initialize() {
        if (!this.runningContextSerive.isCapacitor) {
            return;
        }
        const result = await AppUpdate.getAppUpdateInfo();
        if (result.updateAvailability !== AppUpdateAvailability.UPDATE_AVAILABLE) {
            return;
        }
        this.toastService.confirm({
            type: "YesNo",
            message: this.resourcesService.newVersionAvailable,
            confirmAction: () => {
                AppUpdate.openAppStore();
            }
        });
    }
}