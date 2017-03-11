/// <reference path="../../../israelhiking.web/services/sidebarservice.ts" />

namespace IsraelHiking.Tests.Services {
    describe("Sidebar Statistics Service", () => {
        var sidebarService: IsraelHiking.Services.SidebarService;

        beforeEach(() => {
            sidebarService = new IsraelHiking.Services.SidebarService();
        });

        it("Should initialize hidden", () => {
            expect(sidebarService.isVisible).toBe(false);
        });
        
        it("Should show when toggled", () => {
            sidebarService.toggle("name");

            expect(sidebarService.isVisible).toBe(true);
            expect(sidebarService.viewName).toBe("name");
        });

        it("Should hide when double toggled", () => {
            sidebarService.toggle("name");
            sidebarService.toggle("name");

            expect(sidebarService.isVisible).toBe(false);
            expect(sidebarService.viewName).toBe("");
        });

        it("Should hide when toggled and then hide", () => {
            sidebarService.toggle("name");
            sidebarService.hide();

            expect(sidebarService.isVisible).toBe(false);
            expect(sidebarService.viewName).toBe("");
        });

        it("Should switch views when toggled with two different views", () => {
            sidebarService.toggle("view1");
            sidebarService.toggle("view2");

            expect(sidebarService.isVisible).toBe(true);
            expect(sidebarService.viewName).toBe("view2");
        });

        it("Should hide when toggled with two different views, last view twice", () => {
            sidebarService.toggle("view1");
            sidebarService.toggle("view2");
            sidebarService.toggle("view2");

            expect(sidebarService.isVisible).toBe(false);
            expect(sidebarService.viewName).toBe("");
        });

        it("Should stay hidden when hide", () => {
            sidebarService.hide();

            expect(sidebarService.isVisible).toBe(false);
        });
    });
}