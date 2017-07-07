﻿import { TestBed, async, inject } from "@angular/core/testing";
import { HttpModule, Http, Response, ResponseOptions, XHRBackend } from "@angular/http";
import { MockBackend } from "@angular/http/testing";
import { GetTextCatalogService } from "./GetTextCatalogService";

describe("GetTextCatalogService", () => {

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [HttpModule],
            providers: [
                GetTextCatalogService,
                { provide: XHRBackend, useClass: MockBackend },
            ]
        });
    });

    it("should support language change", inject([GetTextCatalogService], (service: GetTextCatalogService) => {
        service.setCurrentLanguage("he");
        expect(service.getCurrentLanguage()).toBe("he");
    }));

    it("should load language file from server", async(inject([GetTextCatalogService, XHRBackend], (service: GetTextCatalogService, mockBackend: MockBackend) => {
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

});