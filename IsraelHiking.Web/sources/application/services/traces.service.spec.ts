import { TestBed, inject } from "@angular/core/testing";
import { HttpClientModule } from "@angular/common/http";
import { HttpClientTestingModule, HttpTestingController } from "@angular/common/http/testing";

import { TracesService } from "./traces.service";
import { Urls } from "../urls";
import { ITrace } from "./traces.service";

describe("Traces Service", () => {
    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                HttpClientModule,
                HttpClientTestingModule
            ],
            providers: [
                TracesService
            ]
        });
    });

    it("Should get missing parts", inject([TracesService, HttpTestingController],
        async (tracesService: TracesService, mockBackend: HttpTestingController) => {

            let trace = { dataUrl: "123" } as ITrace;

            let promise = tracesService.getMissingParts(trace).then((res) => {
                expect(res).not.toBeNull();
            });

            mockBackend.expectOne(Urls.osm + "?url=" + trace.dataUrl).flush({});
            return promise;
        }));
});