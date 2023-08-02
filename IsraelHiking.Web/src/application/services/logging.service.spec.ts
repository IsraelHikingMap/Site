import { TestBed, inject } from "@angular/core/testing";
import Dexie from "dexie";

import { LoggingService } from "./logging.service";
import { RunningContextService } from "./running-context.service";
import { HttpErrorResponse } from "@angular/common/http";

describe("LoggingService", () => {

    let service: LoggingService;

    beforeEach(async () => {
        TestBed.configureTestingModule({
            imports: [],
            providers: [
                LoggingService,
                { provide: RunningContextService, useValue: { isProduction: false } }
            ]
        });

        service = TestBed.inject(LoggingService);
        await service.initialize(false);
    });

    afterEach(async () => {
        service.uninitialize();
        await Dexie.delete("Logging");
    })

    it("Should log info and returned logged data", async () => {
        await service.info("Hello!");

        let logs = await service.getLog();

        expect(logs.split("\n").length).toBe(1);
    });

    it("Should log info and returned logged data", async () => {
        await service.warning("Hello!");

        let logs = await service.getLog();

        expect(logs.split("\n").length).toBe(1);
    });

    it("Should log error and returned logged data", async () => {
        await service.error("Hello!");

        let logs = await service.getLog();

        expect(logs.split("\n").length).toBe(1);
    });

    it("Should log debug and returned logged data", async () => {
        await service.debug("Hello!");

        let logs = await service.getLog();

        expect(logs.split("\n").length).toBe(1);
    });

    it("Should classify regular error as server", async () => {
        let typeAndMessage = service.getErrorTypeAndMessage(new Error());
        expect(typeAndMessage.type).toBe("server");
    });

    it("Should classify timeout error", async () => {
        let timeoutError = new Error();
        timeoutError.name = "TimeoutError";
        let typeAndMessage = service.getErrorTypeAndMessage(timeoutError);
        expect(typeAndMessage.type).toBe("timeout");
    });

    it("Should classify client side error", async () => {
        let timeoutError = new HttpErrorResponse({
            error: new ProgressEvent({} as any)
        });
        let typeAndMessage = service.getErrorTypeAndMessage(timeoutError);
        expect(typeAndMessage.type).toBe("client");
    });

    it("Should classify serverside side error and return status code", async () => {
        let timeoutError = new HttpErrorResponse({
            status: 404
        });
        let typeAndMessage = service.getErrorTypeAndMessage(timeoutError);
        expect(typeAndMessage.statusCode).toBe(404);
        expect(typeAndMessage.type).toBe("server");
    });

});