import { SidebarService } from "./sidebar.service";

describe("SidebarService", () => {
    let service: SidebarService;

    beforeEach(() => {
        service = new SidebarService;
    });

    it("Should initialize hidden", () => {
        expect(service.isVisible).toBeFalsy();
    });

    it("Should show when toggled", () => {
        service.toggle("info");

        expect(service.isVisible).toBeTruthy();
        expect(service.viewName).toBe("info");
    });

    it("Should hide when double toggled", () => {
        service.toggle("info");
        service.toggle("info");

        expect(service.isVisible).toBeFalsy();
        expect(service.viewName).toBe("");
    });

    it("Should hide when toggled and then hide", () => {
        service.toggle("info");
        service.hide();

        expect(service.isVisible).toBeFalsy();
        expect(service.viewName).toBe("");
    });

    it("Should switch views when toggled with two different views", () => {
        service.toggle("info");
        service.toggle("layers");

        expect(service.isVisible).toBeTruthy();
        expect(service.viewName).toBe("layers");
    });

    it("Should hide when toggled with two different views, last view twice", () => {
        service.toggle("info");
        service.toggle("layers");
        service.toggle("layers");

        expect(service.isVisible).toBeFalsy();
        expect(service.viewName).toBe("");
    });

    it("Should stay hidden when hide", () => {
        service.hide();

        expect(service.isVisible).toBeFalsy();
    });
});