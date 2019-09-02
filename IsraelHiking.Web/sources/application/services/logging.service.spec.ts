import { LoggingService } from "./logging.service";
import { TestBed, inject, fakeAsync, flushMicrotasks } from "@angular/core/testing";
import { RunningContextService } from "./running-context.service";

describe("LoggingService", () => {
    let loggingService: LoggingService;

    beforeEach(() => {
        let runningContextServiceMock = {
            isCordova: false
        };

        TestBed.configureTestingModule({
            imports: [],
            providers: [
                { provide: RunningContextService, useValue: runningContextServiceMock },
                LoggingService
            ]
        });
        loggingService = TestBed.get<LoggingService>(LoggingService);
    });

    it("should init logger instance", () => {
        loggingService.info("debug");
    });
});
