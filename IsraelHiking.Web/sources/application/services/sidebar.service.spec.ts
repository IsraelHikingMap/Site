import { SidebarService } from "./sidebar.service";

describe("SidebarService", () => {
    var service: SidebarService;

    beforeEach(() => {
        service = new SidebarService;
    });

    it("Should initialize hidden", () => {
        expect(service.isVisible).toBeFalsy();
    });

    it("Should show when toggled", () => {
        service.toggle("name");

        expect(service.isVisible).toBeTruthy();
        expect(service.viewName).toBe("name");
    });

    it("Should hide when double toggled", () => {
        service.toggle("name");
        service.toggle("name");

        expect(service.isVisible).toBeFalsy();
        expect(service.viewName).toBe("");
    });

    it("Should hide when toggled and then hide", () => {
        service.toggle("name");
        service.hide();

        expect(service.isVisible).toBeFalsy();
        expect(service.viewName).toBe("");
    });

    it("Should switch views when toggled with two different views", () => {
        service.toggle("view1");
        service.toggle("view2");

        expect(service.isVisible).toBeTruthy();
        expect(service.viewName).toBe("view2");
    });

    it("Should hide when toggled with two different views, last view twice", () => {
        service.toggle("view1");
        service.toggle("view2");
        service.toggle("view2");

        expect(service.isVisible).toBeFalsy();
        expect(service.viewName).toBe("");
    });

    it("Should stay hidden when hide", () => {
        service.hide();

        expect(service.isVisible).toBeFalsy();
    });
});