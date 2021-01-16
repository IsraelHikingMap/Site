import { LoggingService } from "./logging.service";
import { TestBed, inject } from "@angular/core/testing";
import { RunningContextService } from "./running-context.service";

describe("LoggingService", () => {

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
    });

    it("should init logger instance", inject([LoggingService], (loggingService: LoggingService) => {
        let spy = spyOn(console, "log");
        loggingService.info("debug");
        expect(console.log).toHaveBeenCalled();
    }));
});
