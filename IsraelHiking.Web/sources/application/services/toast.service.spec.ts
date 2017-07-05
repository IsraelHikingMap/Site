import { MdSnackBar } from "@angular/material";
import { ToastService } from "./ToastService";
import { ResourcesService } from "./ResourcesService";
import { GetTextCatalogMockCreator } from "./resources.service.spec";

export class ToastServiceMockCreator {
    public toastService: ToastService;
    public resourcesService: ResourcesService;
    constructor() {
        let snackBar = new MdSnackBar(null, null, null);
        spyOn(snackBar, "open").and.returnValue(null);
        this.resourcesService = new ResourcesService(new GetTextCatalogMockCreator().getTextCatalogService);
        this.toastService = new ToastService(this.resourcesService, snackBar);
    }
}

describe("ToastService", () => {
    it("should raise toast", () => {
        let service = new ToastServiceMockCreator().toastService;

        expect(() => service.error("")).not.toThrow()
        expect(() => service.warning("")).not.toThrow()
        expect(() => service.info("")).not.toThrow()
        expect(() => service.success("")).not.toThrow()
    });
});