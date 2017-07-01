import { MdSnackBar } from "@angular/material";
import { ToastService } from "./ToastService";
import { ResourcesService } from "./ResourcesService";
import { GetTextCatalogMockCreator } from "./resources.service.spec";

export class ToastServiceMockCreator {
    public toastService: ToastService;
    constructor() {
        let snackBar = new MdSnackBar(null, null, null);
        spyOn(snackBar, "open").and.returnValue(null);
        this.toastService = new ToastService(new ResourcesService(new GetTextCatalogMockCreator().getTextCatalogService), snackBar);
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