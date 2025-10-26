import { TestBed, inject } from "@angular/core/testing";
import { NgxsModule } from "@ngxs/store";
import { expect, it, describe, beforeEach } from "vitest";

import { SidebarService } from "./sidebar.service";

describe("SidebarService", () => {

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [NgxsModule.forRoot([])],
            providers: [
                SidebarService
            ]
        });
    });

    it("Should initialize hidden", inject([SidebarService], (service: SidebarService) => {
        expect(service.isSidebarOpen()).toBeFalsy();
    }));

    it("Should show when toggled", inject([SidebarService], (service: SidebarService) => {
        service.toggle("info");

        expect(service.isSidebarOpen()).toBeTruthy();
        expect(service.viewName).toBe("info");
    }));

    it("Should hide when double toggled", inject([SidebarService], (service: SidebarService) => {
        service.toggle("info");
        service.toggle("info");

        expect(service.isSidebarOpen()).toBeFalsy();
        expect(service.viewName).toBe("");
    }));

    it("Should hide when toggled and then hide", inject([SidebarService], (service: SidebarService) => {
        service.toggle("info");
        service.hide();

        expect(service.isSidebarOpen()).toBeFalsy();
        expect(service.viewName).toBe("");
    }));

    it("Should switch views when toggled with two different views", inject([SidebarService], (service: SidebarService) => {
        service.toggle("info");
        service.toggle("layers");

        expect(service.isSidebarOpen()).toBeTruthy();
        expect(service.viewName).toBe("layers");
    }));

    it("Should hide when toggled with two different views, last view twice", inject([SidebarService], (service: SidebarService) => {
        service.toggle("info");
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
