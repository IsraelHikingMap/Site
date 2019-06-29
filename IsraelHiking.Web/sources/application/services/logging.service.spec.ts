import { LoggingService } from "./logging.service";
import { TestBed, inject, fakeAsync, flushMicrotasks } from "@angular/core/testing";
import { RunningContextService } from "./running-context.service";


describe("LoggingService", () => {
    let loggingService: LoggingService;

    beforeEach(() => {
        let runningContextServiceMock = {
            isCordova: true
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

    it("should create IHM directory when in cordova debug when initializing", async () => {
        (window as any).device = { platform: "iOS" };
        (window as any).cordova = {
            file: { documentsDirectory: "docs" }
        };
        let spy = jasmine.createSpy('resolveLocalFileSystemURL');
        let dir = {
            getDirectory: (name, options, successCallback, failureCallback) => successCallback({
                getFile: (name, options, success, failure) => {
                    failure();
                }
            })
        } as any as Entry;
        spy.and.callFake((folder, func) => func(dir));
        (window as any).resolveLocalFileSystemURL = spy;

        await loggingService.initialize();

        expect((window as any).resolveLocalFileSystemURL).toHaveBeenCalled();
    });
});