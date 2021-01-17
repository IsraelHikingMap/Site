import { Injectable, ErrorHandler } from "@angular/core";

import { LoggingService } from "./logging.service";
import { RunningContextService } from "./running-context.service";

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {

    constructor(private readonly loggingService: LoggingService) {
    }

    public handleError(error: Error) {
        let message = error.message || error.toString();
        if (error.stack) {
            message += `\n${error.stack}`;
        }
        this.loggingService.error(message);
    }
}
