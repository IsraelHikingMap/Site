import { enableProdMode, NgZone } from "@angular/core";
import { environment } from "./environments/environment";
import { bootstrapApplication } from "@angular/platform-browser";
import { appConfig } from "./application/app.config";
import { AppRootComponent } from "./application/components/screens/app-root.component";
import "../node_modules/zone.js/fesm2015/task-tracking";
import { clone, size } from "lodash";

// See https://github.com/ionic-team/capacitor/issues/1564
export class FileReaderFixForCapacitor extends FileReader {
    constructor() {
        super();
        // eslint-disable-next-line
        const zoneOriginalInstance = (this as any).__zone_symbol__originalInstance;
        return zoneOriginalInstance || this;
    }
}
window.FileReader = FileReaderFixForCapacitor;

if (environment.production) {
    enableProdMode();
}

bootstrapApplication(AppRootComponent, appConfig)

    .then(moduleInstance => {
        // Ensure Angular destroys itself on hot reloads.
        //if (window["ngRef"]) {
        //    window["ngRef"].destroy();
        //}
        //window["ngRef"] = moduleInstance;

        const ngZone = moduleInstance.injector.get(NgZone);
        setInterval(() => {
            var taskTrackingZone = (<any>ngZone)._inner.getZoneWith("TaskTrackingZone");
            if (!taskTrackingZone) {
                throw new Error("'TaskTrackingZone' zone not found! Have you loaded 'node_modules/zone.js/dist/task-tracking.js'?");
            }
            var tasks: any[] = taskTrackingZone._properties.TaskTrackingZone.getTasksFor("macroTask");
            tasks = clone(tasks);
            if (size(tasks) > 0) {
                console.log("ZONE pending tasks=", tasks);
            }
        }, 200);

        // Otherwise, log the boot error
    })
    .catch(err => console.error(err));

