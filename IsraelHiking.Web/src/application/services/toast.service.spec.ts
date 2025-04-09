import { inject, TestBed } from "@angular/core/testing";
import { MatSnackBar } from "@angular/material/snack-bar";
import { MatDialog } from "@angular/material/dialog";

import { IConfirmOptions, ToastService } from "./toast.service";
import { ResourcesService } from "./resources.service";
import { ConfirmDialogComponent } from "../components/dialogs/confirm-dialog.component";
import { LoggingService } from "./logging.service";

describe("ToastService", () => {
    let confirmDialog: ConfirmDialogComponent;
    beforeEach(() => {
        confirmDialog = {} as any;
        const snackBar = { 
            open: () => null as any, 
            dismiss: jasmine.createSpy(),
            openFromComponent: () => { return { instance: confirmDialog } }
        } as any;
        const resourceServiceMock = {
            yes: "yes",
            no: "no",
            ok: "ok",
            cancel: "cancel",
        };

        TestBed.configureTestingModule({
            providers: [
                {provide: MatSnackBar, useValue: snackBar},
                {provide: ResourcesService, useValue: resourceServiceMock},
                {provide: MatDialog, useValue: {}},
                {provide: LoggingService, useValue: { error: () => {} }},
                ToastService
            ]
        });
    })
    
    it("should raise toast", inject([ToastService], (service: ToastService) => {
        expect(() => service.error(new Error(""), "")).not.toThrow();
        expect(() => service.warning("")).not.toThrow();
        expect(() => service.info("")).not.toThrow();
        expect(() => service.success("")).not.toThrow();
    }));

    it("should raise OK confirm toast and dismiss it when clicked", 
        inject([ToastService, MatSnackBar, ResourcesService], 
            (service: ToastService, snackBar: MatSnackBar, resourcesService: ResourcesService) => {
        const options: IConfirmOptions = {
            message: "message",
            type: "Ok",
            confirmAction: jasmine.createSpy()
        } 

        service.confirm(options);

        confirmDialog.confirmAction();

        expect(snackBar.dismiss).toHaveBeenCalled();
        expect(confirmDialog.confirmButtonText).toBe(resourcesService.ok);
    }));

    it("should raise OKCancel confirm toast and dismiss it when clicked", 
        inject([ToastService, MatSnackBar, ResourcesService], 
            (service: ToastService, snackBar: MatSnackBar, resourcesService: ResourcesService) => {
        const options: IConfirmOptions = {
            message: "message",
            type: "OkCancel",
            confirmAction: () => {},
            declineAction: () => {}
        } 

        service.confirm(options);

        confirmDialog.declineAction();

        expect(snackBar.dismiss).toHaveBeenCalled();
        expect(confirmDialog.confirmButtonText).toBe(resourcesService.ok);
        expect(confirmDialog.declineButtonText).toBe(resourcesService.cancel);
    }));

    it("should raise YesNo confirm toast and dismiss it when clicked", 
        inject([ToastService, MatSnackBar, ResourcesService], 
            (service: ToastService, snackBar: MatSnackBar, resourcesService: ResourcesService) => {

        const options: IConfirmOptions = {
            message: "message",
            type: "YesNo",
            confirmAction: () => {},
            declineAction: () => {}
        } 

        service.confirm(options);

        confirmDialog.declineAction();

        expect(snackBar.dismiss).toHaveBeenCalled();
        expect(confirmDialog.confirmButtonText).toBe(resourcesService.yes);
        expect(confirmDialog.declineButtonText).toBe(resourcesService.no);
    }));

    it("should raise custom confirm toast and dismiss it when clicked",
        inject([ToastService, MatSnackBar], 
            (service: ToastService, snackBar: MatSnackBar) => {
        const options: IConfirmOptions = {
            message: "message",
            type: "Custom",
            customConfirmText: "custom confirm",
            customDeclineText: "custom decline",
            confirmAction: () => {},
            declineAction: () => {}
        } 

        service.confirm(options);

        confirmDialog.confirmAction();

        expect(snackBar.dismiss).toHaveBeenCalled();
        expect(confirmDialog.confirmButtonText).toBe(options.customConfirmText);
        expect(confirmDialog.declineButtonText).toBe(options.customDeclineText);
    }));

    it("should raise undo toast and call final action when dismissed",
        inject([ToastService, MatSnackBar],
            (service: ToastService, snackBar: MatSnackBar) => {
        const undoAction = jasmine.createSpy();
        const cleanup = jasmine.createSpy();
        const snackbarRef = {
            onAction: () => ({ subscribe: (callback: () => void) => callback() }),
            afterDismissed: () => ({ subscribe: (callback: () => void) => callback() })
        } as any;
        spyOn(snackBar, "open").and.returnValue(snackbarRef);
        service.undo("message", undoAction, cleanup);
        expect(undoAction).toHaveBeenCalled();
        expect(cleanup).not.toHaveBeenCalled();
    }));

    it("should raise undo toast and call final action when dismissed without undo",
        inject([ToastService, MatSnackBar],
            (service: ToastService, snackBar: MatSnackBar) => {
        const undoAction = jasmine.createSpy();
        const cleanup = jasmine.createSpy();
        const message = "message";
        const snackbarRef = {
            onAction: () => ({ subscribe: () => {} }),
            afterDismissed: () => ({ subscribe: (callback: () => void) => callback() })
        } as any;
        spyOn(snackBar, "open").and.returnValue(snackbarRef);
        service.undo(message, undoAction, cleanup);
        expect(undoAction).not.toHaveBeenCalled();
        expect(cleanup).toHaveBeenCalled();
    }));
});
