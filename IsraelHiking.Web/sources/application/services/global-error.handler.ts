import { Injectable, ErrorHandler } from '@angular/core';

import { LoggingService } from './logging.service';
import { RunningContextService } from './running-context.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {

    constructor(private readonly loggingService: LoggingService,
        private readonly runningContextService: RunningContextService) {
    }

    public handleError(error) {
        if (this.runningContextService.isCordova) {
            this.loggingService.error(error);
        }
    }
}