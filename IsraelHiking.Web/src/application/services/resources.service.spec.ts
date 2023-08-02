import { TestBed, inject } from "@angular/core/testing";
import { NgxsModule, Store } from "@ngxs/store";

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
        const mockCreator = new GetTextCatalogMockCreator();
        TestBed.configureTestingModule({
            imports: [NgxsModule.forRoot([])],
            providers: [
                { provide: GetTextCatalogService, useValue: mockCreator.getTextCatalogService },
                ResourcesService
            ]
        });
    });

    it("Should faciliate language change to english and raise event", inject([ResourcesService, Store],
        (service: ResourcesService, store: Store) => {

        store.reset({
            configuration: {
                language: {
                    code: "he"
                }
            }
        });
        store.dispatch = jasmine.createSpy();

        const promise = service.setLanguage("he").then(() => {
            expect(service.getCurrentLanguageCodeSimplified()).toBe("he");
            expect(store.dispatch).toHaveBeenCalled();
        });
        return promise;
    }));

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
        expect(service.getDirection("")).toBeUndefined();
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

    it("Should get null when trying to resize nu", inject([ResourcesService], (service: ResourcesService) => {
        expect(service.getResizedImageUrl(null, 1)).toBe(null);
    }));

    it("Should alter wikimedia url and resize it", inject([ResourcesService], (service: ResourcesService) => {
        let url = service.getResizedImageUrl("https://upload.wikimedia.org/wikipedia/commons/4/5/7.svg", 123);
        expect(url).toContain("123");
        expect(url).toContain("png");
    }));

    it("Should alter imgur url and resize it according to size", inject([ResourcesService], (service: ResourcesService) => {
        expect(service.getResizedImageUrl("https://i.imgur.com/456.png", 123)).toContain("456t");
        expect(service.getResizedImageUrl("https://i.imgur.com/456.png", 345)).toContain("456m");
        expect(service.getResizedImageUrl("https://i.imgur.com/456.png", 600)).toContain("456l");
        expect(service.getResizedImageUrl("https://i.imgur.com/456.png", 800)).toContain("456");
    }));

    it("Should after wikipedia file url", inject([ResourcesService], (service: ResourcesService) => {
        expect(service.getResizedImageUrl("File:456.png", 123)).toContain("Redirect/file/");
    }));
});
