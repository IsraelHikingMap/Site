import { TestBed, inject } from "@angular/core/testing";
import { HttpClientModule } from "@angular/common/http";
import { HttpClientTestingModule, HttpTestingController } from "@angular/common/http/testing";
import { NgRedux } from "@angular-redux/store";

import { TracesService } from "./traces.service";
import { LoggingService } from "./logging.service";
import { Urls } from "../urls";
import { Trace } from "../models/models";
import { ToastServiceMockCreator } from "./toast.service.spec";
import { ResourcesService } from "./resources.service";

describe("Traces Service", () => {
    beforeEach(() => {
        let mock = new ToastServiceMockCreator();
        TestBed.configureTestingModule({
            imports: [
                HttpClientModule,
                HttpClientTestingModule
            ],
            providers: [
                NgRedux,
                TracesService,
                { provide: ResourcesService, useValue: mock.resourcesService },
                { provide: LoggingService, useValue: {} },
            ]
        });
    });

    it("Should get missing parts", inject([TracesService, HttpTestingController],
        async (tracesService: TracesService, mockBackend: HttpTestingController) => {

            let trace = { id: "123" } as Trace;

            let promise = tracesService.getMissingParts(trace.id).then((res) => {
                expect(res).not.toBeNull();
            });

            mockBackend.expectOne(Urls.osm + "?traceId=" + trace.id).flush({});
            return promise;
        }));
});
