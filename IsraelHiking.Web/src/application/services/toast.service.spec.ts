import { MatDialog } from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { ToastService } from "./toast.service";
import { ResourcesService } from "./resources.service";
import { LoggingService } from "./logging.service";
import { GetTextCatalogMockCreator } from "./resources.service.spec";

export class ToastServiceMockCreator {
    public toastService: ToastService;
    public resourcesService: ResourcesService;
    constructor() {
        let snackBar = { open: () => null } as any as MatSnackBar;
        let matDialog = { open: () => null } as any as MatDialog;
        let loggingService = { error: () => { }, info: () => { } } as any as LoggingService;
        this.resourcesService = new ResourcesService(new GetTextCatalogMockCreator().getTextCatalogService,
            { getState: () => ({ configuration: { language: {code: "he" } as any}} as any)} as any);
        this.toastService = new ToastService(this.resourcesService, matDialog, snackBar, loggingService);
    }
}

describe("ToastService", () => {
    it("should raise toast", () => {
        let service = new ToastServiceMockCreator().toastService;

        expect(() => service.error(new Error(""), "")).not.toThrow();
        expect(() => service.warning("")).not.toThrow();
        expect(() => service.info("")).not.toThrow();
        expect(() => service.success("")).not.toThrow();
    });
});
