import { MatDialog } from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { IConfirmOptions, ToastService } from "./toast.service";
import { ResourcesService } from "./resources.service";
import { LoggingService } from "./logging.service";
import { GetTextCatalogMockCreator } from "./resources.service.spec";
import { ConfirmDialogComponent } from "application/components/dialogs/confirm-dialog.component";

export class ToastServiceMockCreator {
    public toastService: ToastService;
    public resourcesService: ResourcesService;
    public snackBar: MatSnackBar;
    public confirmDialog: ConfirmDialogComponent;
    constructor() {
        const matDialog = { open: () => null as any } as any as MatDialog;
        const loggingService = { error: () => { }, info: () => { } } as any as LoggingService;
        this.resourcesService = new ResourcesService(new GetTextCatalogMockCreator().getTextCatalogService,
            { selectSnapshot: () => ({ language: {code: "he" } as any}) } as any);
        this.resourcesService.yes = "yes";
        this.resourcesService.no = "no";
        this.resourcesService.ok = "ok";
        this.resourcesService.cancel = "cancel";
        this.confirmDialog = new ConfirmDialogComponent(this.resourcesService);
        this.snackBar = { 
            open: () => null as any, 
            dismiss: jasmine.createSpy(),
            openFromComponent: () => { return { instance: this.confirmDialog } }
        } as any;
        this.toastService = new ToastService(this.resourcesService, matDialog, this.snackBar, loggingService);
    }
}

describe("ToastService", () => {
    it("should raise toast", () => {
        const service = new ToastServiceMockCreator().toastService;

        expect(() => service.error(new Error(""), "")).not.toThrow();
        expect(() => service.warning("")).not.toThrow();
        expect(() => service.info("")).not.toThrow();
        expect(() => service.success("")).not.toThrow();
    });

    it("should raise OK confirm toast and dismiss it when clicked", () => {
        const mock = new ToastServiceMockCreator();
        const service = mock.toastService;

        const options: IConfirmOptions = {
            message: "message",
            type: "Ok",
            confirmAction: jasmine.createSpy()
        } 

        service.confirm(options);

        mock.confirmDialog.confirmAction();

        expect(mock.snackBar.dismiss).toHaveBeenCalled();
        expect(mock.confirmDialog.confirmButtonText).toBe(mock.resourcesService.ok);
    });

    it("should raise OKCancel confirm toast and dismiss it when clicked", () => {
        const mock = new ToastServiceMockCreator();
        const service = mock.toastService;

        const options: IConfirmOptions = {
            message: "message",
            type: "OkCancel",
            confirmAction: () => {},
            declineAction: () => {}
        } 

        service.confirm(options);

        mock.confirmDialog.declineAction();

        expect(mock.snackBar.dismiss).toHaveBeenCalled();
        expect(mock.confirmDialog.confirmButtonText).toBe(mock.resourcesService.ok);
        expect(mock.confirmDialog.declineButtonText).toBe(mock.resourcesService.cancel);
    });

    it("should raise YesNo confirm toast and dismiss it when clicked", () => {
        const mock = new ToastServiceMockCreator();
        const service = mock.toastService;

        const options: IConfirmOptions = {
            message: "message",
            type: "YesNo",
            confirmAction: () => {},
            declineAction: () => {}
        } 

        service.confirm(options);

        mock.confirmDialog.declineAction();

        expect(mock.snackBar.dismiss).toHaveBeenCalled();
        expect(mock.confirmDialog.confirmButtonText).toBe(mock.resourcesService.yes);
        expect(mock.confirmDialog.declineButtonText).toBe(mock.resourcesService.no);
    });

    it("should raise custom confirm toast and dismiss it when clicked", () => {
        const mock = new ToastServiceMockCreator();
        const service = mock.toastService;

        const options: IConfirmOptions = {
            message: "message",
            type: "Custom",
            customConfirmText: "custom confirm",
            customDeclineText: "custom decline",
            confirmAction: () => {},
            declineAction: () => {}
        } 

        service.confirm(options);

        mock.confirmDialog.confirmAction();

        expect(mock.snackBar.dismiss).toHaveBeenCalled();
        expect(mock.confirmDialog.confirmButtonText).toBe(options.customConfirmText);
        expect(mock.confirmDialog.declineButtonText).toBe(options.customDeclineText);
    });
});
