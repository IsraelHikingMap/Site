import { inject, Injectable } from "@angular/core";
import { AppUpdate, AppUpdateAvailability } from "@capawesome/capacitor-app-update";

import { RunningContextService } from "./running-context.service";
import { ToastService } from "./toast.service";
import { ResourcesService } from "./resources.service";
import { LoggingService } from "./logging.service";

@Injectable()
export class ApplicationUpdateService {

    private readonly resourcesService = inject(ResourcesService);
    private readonly runningContextSerive = inject(RunningContextService);
    private readonly toastService = inject(ToastService);
    private readonly loggingService = inject(LoggingService);

    public async initialize() {
        if (!this.runningContextSerive.isCapacitor) {
            return;
        }
        try {
            const result = await AppUpdate.getAppUpdateInfo();
            if (result.updateAvailability !== AppUpdateAvailability.UPDATE_AVAILABLE) {
                return;
            }
            this.toastService.confirm({
                type: "YesNo",
                message: this.resourcesService.newVersionAvailable,
                confirmAction: () => {
                    if (result.immediateUpdateAllowed) {
                        AppUpdate.performImmediateUpdate();
                    } else {
                        AppUpdate.openAppStore();
                    }
                }, 
                declineAction: () => {
                    if (result.flexibleUpdateAllowed) {
                        AppUpdate.startFlexibleUpdate();
                    }
                }
            });
        } catch (ex) {
            this.loggingService.warning("[Application Update] Failed to check for updates: " + (ex as Error).message);
        }
        
    }
}