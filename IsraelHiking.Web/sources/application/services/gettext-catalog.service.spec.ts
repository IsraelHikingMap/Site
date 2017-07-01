import { TestBed, async, inject } from "@angular/core/testing";
import { HttpModule, Http, Response, ResponseOptions, XHRBackend } from "@angular/http";
import { MockBackend } from "@angular/http/testing";
import { GetTextCatalogService } from "./GetTextCatalogService";

describe("GetTextCatalogService", () => {
    //var service: GetTextCatalogService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [HttpModule],
            providers: [
                GetTextCatalogService,
                { provide: XHRBackend, useClass: MockBackend },
            ]
        });
    });

    it("should support language change", inject([GetTextCatalogService, XHRBackend], (service: GetTextCatalogService, backend: XHRBackend) => {
        service.setCurrentLanguage("he");
        expect(service.getCurrentLanguage()).toBe("he");
    }));
});