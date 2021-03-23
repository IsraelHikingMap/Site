import { TestBed, inject } from "@angular/core/testing";
import { MockNgRedux, NgReduxTestingModule } from "../reducers/infra/ng-redux-testing.module";

import { ResourcesService } from "./resources.service";
import { GetTextCatalogService } from "./gettext-catalog.service";
import { NgModuleResolver } from "@angular/compiler";

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
            imports: [NgReduxTestingModule],
            providers: [
                { provide: GetTextCatalogService, useValue: mockCreator.getTextCatalogService },
                ResourcesService
            ]
        });
        MockNgRedux.reset();
    });

    it("Should faciliate language change to english and raise event", inject([ResourcesService], (service: ResourcesService) => {
        let eventRaied = false;

        MockNgRedux.getInstance().getState = () => ({
            configuration: {
                language: {
                    code: "he"
                }
            }
        });
        MockNgRedux.getInstance().dispatch = jasmine.createSpy();

        let promise = service.setLanguage({ code: "he", rtl: true}).then(() => {
            expect(service.getCurrentLanguageCodeSimplified()).toBe("he");
            expect(MockNgRedux.getInstance().dispatch).toHaveBeenCalled();
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
