import { TestBed, async, inject } from "@angular/core/testing";
import { ResourcesService } from "./resources.service";
import { GetTextCatalogService } from "./gettext-catalog.service";

export class GetTextCatalogMockCreator {
    public getTextCatalogService: GetTextCatalogService;

    public constructor() {
        this.getTextCatalogService = new GetTextCatalogService(null);
        spyOn(this.getTextCatalogService, "loadRemote").and.returnValue(new Promise((resolve) => { resolve(); }));
    }
}

describe("ResourcesService", () => {

    beforeEach(() => {
        let mockCreator = new GetTextCatalogMockCreator();
        TestBed.configureTestingModule({
            providers: [
                { provide: GetTextCatalogService, useValue: mockCreator.getTextCatalogService },
                ResourcesService
            ]
        });
    });

    it("Should have available languages on startup", inject([ResourcesService], (service: ResourcesService) => {
        expect(service.availableLanguages.length).toBeGreaterThan(0);
    }));

    it("Should faciliate language change to english and raise event", async(inject([ResourcesService], (service: ResourcesService) => {
        let eventRaied = false;
        service.languageChanged.subscribe(() => { eventRaied = true; });

        service.setLanguage(service.availableLanguages[1]).then(() => {
            expect(service.currentLanguage.code).toBe(service.availableLanguages[1].code);
            expect(eventRaied).toBeTruthy();
        });
    })));

    it("Should faciliate translation", inject([ResourcesService, GetTextCatalogService],
        (service: ResourcesService, getText: GetTextCatalogService) => {

        spyOn(getText, "getString").and.returnValue("word's translation");

        expect(service.translate("word")).toBe("word's translation");
    }));

    it("Should be able to test if a text contains hebrew", inject([ResourcesService], (service: ResourcesService) => {
        expect(service.hasRtlCharacters("שלום")).toBeTruthy();
        expect(service.hasRtlCharacters("1. שלום")).toBeTruthy();
        expect(service.hasRtlCharacters("1. نص عربي")).toBeTruthy();
        expect(service.hasRtlCharacters("hello")).toBeFalsy();
        expect(service.hasRtlCharacters("1. hello")).toBeFalsy();
    }));

    it("Should be able get the layout direction for titles", inject([ResourcesService], (service: ResourcesService) => {
        expect(service.getDirection("שלום")).toBe("rtl");
        expect(service.getDirection("1. שלום")).toBe("rtl");
        expect(service.getDirection("hello")).toBe("ltr");
        expect(service.getDirection("1. hello")).toBe("ltr");
    }));

    it("Should be able get the text alignment for titles", inject([ResourcesService], (service: ResourcesService) => {
        expect(service.getTextAlignment("שלום")).toBe("text-right");
        expect(service.getTextAlignment("1. שלום")).toBe("text-right");
        expect(service.getTextAlignment("hello")).toBe("text-left");
        expect(service.getTextAlignment("1. hello")).toBe("text-left");
    }));
});