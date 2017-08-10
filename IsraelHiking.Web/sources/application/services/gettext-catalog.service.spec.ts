import { TestBed, async, inject } from "@angular/core/testing";
import { HttpModule, Response, ResponseOptions, XHRBackend } from "@angular/http";
import { MockBackend } from "@angular/http/testing";
import { GetTextCatalogService } from "./gettext-catalog.service";

describe("GetTextCatalogService", () => {

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [HttpModule],
            providers: [
                GetTextCatalogService,
                { provide: XHRBackend, useClass: MockBackend }
            ]
        });
    });

    it("Should support language change", inject([GetTextCatalogService], (service: GetTextCatalogService) => {
        service.setCurrentLanguage("he");
        expect(service.getCurrentLanguage()).toBe("he");
    }));

    it("Should load language file from server", async(inject([GetTextCatalogService, XHRBackend], (service: GetTextCatalogService, mockBackend: MockBackend) => {
        service.setCurrentLanguage("he");

        mockBackend.connections.subscribe((connection) => {
            connection.mockRespond(new Response(new ResponseOptions({
                body: JSON.stringify({ he: { "word": "word's translation" } })
            })));
        });

        return service.loadRemote("url").then(() => {
            expect(service.getString("word")).toBe("word's translation");
        });
    })));

    it("Should return original word when translation is missing", async(inject([GetTextCatalogService, XHRBackend], (service: GetTextCatalogService, mockBackend: MockBackend) => {
        service.setCurrentLanguage("he");

        mockBackend.connections.subscribe((connection) => {
            connection.mockRespond(new Response(new ResponseOptions({
                body: JSON.stringify({ he: {} })
            })));
        });

        return service.loadRemote("url").then(() => {
            expect(service.getString("word")).toBe("word");
        });
    })));

});