import { Injectable } from "@angular/core";
import BackgroundGeoLocation, { Logger } from "cordova-background-geolocation-lt";

import { RunningContextService } from "./running-context.service";

@Injectable()
export class LoggingService {
    private logger: Logger;

    constructor(private readonly runningContextService: RunningContextService) {
        if (this.runningContextService.isCordova) {
            this.logger = BackgroundGeoLocation.logger;
        } else {
            this.logger = {
                info: (message) => {
                    message = new Date().toISOString() + " | INFO  | " + message;
                    console.log(message);
                },
                debug: (message) => {
                    message = new Date().toISOString() + " | DEBUG | " + message;
                    // tslint:disable-next-line
                    console.debug(message);
                },
                error: (message) => {
                    message = new Date().toISOString() + " | ERROR | " + message;
                    console.error(message);
                }
            } as any;
        }
    }

    public info(message: string) {
        this.logger.info(message);
    }

    public debug(message: string) {
        // for testing to see how it behaves in production.
        // if (this.runningContextService.isProduction) {
        //    return;
        // }
        this.logger.debug(message);
    }

    public error(message: string) {
        this.logger.error(message);
    }

    public emailLog() {
        BackgroundGeoLocation.emailLog("israelhikingmap@gmail.com");
    }
}
