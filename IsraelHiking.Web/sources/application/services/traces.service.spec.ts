import { TestBed, inject } from "@angular/core/testing";
import { HttpClientModule } from "@angular/common/http";
import { HttpClientTestingModule, HttpTestingController } from "@angular/common/http/testing";
import { NgRedux } from "@angular-redux/store";

import { TracesService } from "./traces.service";
import { Urls } from "../urls";
import { Trace } from "../models/models";

describe("Traces Service", () => {
    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                HttpClientModule,
                HttpClientTestingModule
            ],
            providers: [
                NgRedux,
                TracesService
            ]
        });
    });

    it("Should get missing parts", inject([TracesService, HttpTestingController],
        async (tracesService: TracesService, mockBackend: HttpTestingController) => {

            let trace = { id: "123" } as Trace;

            let promise = tracesService.getMissingParts(trace).then((res) => {
                expect(res).not.toBeNull();
            });

            mockBackend.expectOne(Urls.osm + "?traceId=" + trace.id).flush({});
            return promise;
        }));
});
