import { Injectable } from "@angular/core";
import { MdSnackBar } from "@angular/material";

@Injectable()
export class ToastService {
    constructor(private snackbar: MdSnackBar) { }

    public error(message: string, title?: string) {
        this.snackbar.open(message, title);
    }

    public warning(message: string, title?: string) {
        this.snackbar.open(message, title);
    }

    public success(message: string, title?: string) {
        this.snackbar.open(message, title);
    }

    public info(message: string, title?: string) {
        this.snackbar.open(message, title);
    }


}