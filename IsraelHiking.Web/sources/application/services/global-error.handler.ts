import { Injectable, ErrorHandler } from "@angular/core";

import { LoggingService } from "./logging.service";
import { RunningContextService } from "./running-context.service";

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {

    constructor(private readonly loggingService: LoggingService) {
    }

    public handleError(error) {
        this.loggingService.error(error);
    }
}
