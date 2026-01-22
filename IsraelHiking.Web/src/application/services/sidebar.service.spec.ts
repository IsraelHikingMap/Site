import { TestBed, inject } from "@angular/core/testing";
import { NgxsModule } from "@ngxs/store";

import { SidebarService } from "./sidebar.service";
import { HashService } from "./hash.service";

describe("SidebarService", () => {

    beforeEach(() => {
        const hashServiceMock = {
            setApplicationState: () => { },
            resetAddressbar: () => { }
        } as any as HashService;
        TestBed.configureTestingModule({
            imports: [NgxsModule.forRoot([])],
            providers: [
                { provide: HashService, useValue: hashServiceMock },
                SidebarService
            ]
        });
    });

    it("Should initialize hidden", inject([SidebarService], (service: SidebarService) => {
        expect(service.isSidebarOpen()).toBeFalsy();
    }));

    it("Should show when toggled", inject([SidebarService], (service: SidebarService) => {
        service.toggle("layers");

        expect(service.isSidebarOpen()).toBeTruthy();
        expect(service.viewName).toBe("layers");
    }));

    it("Should hide when double toggled", inject([SidebarService], (service: SidebarService) => {
        service.toggle("layers");
        service.toggle("layers");

        expect(service.isSidebarOpen()).toBeFalsy();
        expect(service.viewName).toBe("");
    }));

    it("Should hide when toggled and then hide", inject([SidebarService], (service: SidebarService) => {
        service.toggle("layers");
        service.hide();

        expect(service.isSidebarOpen()).toBeFalsy();
        expect(service.viewName).toBe("");
    }));

    it("Should switch views when toggled with two different views", inject([SidebarService], (service: SidebarService) => {
        service.toggle("public-poi");
        service.toggle("layers");

        expect(service.isSidebarOpen()).toBeTruthy();
        expect(service.viewName).toBe("layers");
    }));

    it("Should hide when toggled with two different views, last view twice", inject([SidebarService], (service: SidebarService) => {
        service.toggle("public-poi");
        service.toggle("layers");
        service.toggle("layers");

        expect(service.isSidebarOpen()).toBeFalsy();
        expect(service.viewName).toBe("");
    }));

    it("Should stay hidden when hide", inject([SidebarService], (service: SidebarService) => {
        service.hide();

        expect(service.isSidebarOpen()).toBeFalsy();
    }));
});
