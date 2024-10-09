import { Injectable, ErrorHandler, inject } from "@angular/core";

import { LoggingService } from "./logging.service";

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {

    private readonly loggingService = inject(LoggingService);

    public handleError(error: Error) {
        let message = error.message || JSON.stringify(error);
        if (error.stack) {
            message += `\n${error.stack}`;
        }
        this.loggingService.error(message);
    }
}
