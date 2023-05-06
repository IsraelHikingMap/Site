import { TestBed, inject } from "@angular/core/testing";
import { HttpClientModule } from "@angular/common/http";
import { HttpClientTestingModule, HttpTestingController } from "@angular/common/http/testing";
import { MockNgRedux, MockNgReduxModule } from "@angular-redux2/store/mocks";

import { TracesService } from "./traces.service";
import { LoggingService } from "./logging.service";
import { ToastServiceMockCreator } from "./toast.service.spec";
import { ResourcesService } from "./resources.service";
import { RunningContextService } from "./running-context.service";
import { DatabaseService } from "./database.service";
import { Urls } from "../urls";
import type { Trace } from "../models/models";

describe("Traces Service", () => {
    beforeEach(() => {
        let mock = new ToastServiceMockCreator();
        let loggignMock = {
            info: () => { }
        };
        TestBed.configureTestingModule({
            imports: [
                HttpClientModule,
                HttpClientTestingModule,
                MockNgReduxModule
            ],
            providers: [
                TracesService,
                { provide: ResourcesService, useValue: mock.resourcesService },
                { provide: LoggingService, useValue: loggignMock },
                { provide: RunningContextService, useValue: null },
                { provide: DatabaseService, useValue: null }
            ]
        });
        MockNgRedux.reset();
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
