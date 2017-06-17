import { Injectable } from "@angular/core";
import { MdSnackBar } from "@angular/material";
import { ResourcesService } from "./ResourcesService";

@Injectable()
export class ToastService {
    private duration: number;

    constructor(private resources: ResourcesService,
        private snackbar: MdSnackBar) {
        this.duration = 2000;
    }

    public error(message: string, title?: string) {
        this.snackbar.open(message, title, {
            direction: this.resources.direction,
            duration: this.duration,
            extraClasses: ["mat-toolbar", "mat-warn"] // for some reason warn is red
        });
    }

    public warning(message: string, title?: string) {
        this.snackbar.open(message, title, {
            direction: this.resources.direction,
            duration: this.duration,
            extraClasses: ["mat-toolbar", "mat-accent"] // for some reason accent is yellow
        });
    }

    public success(message: string, title?: string) {
        this.snackbar.open(message, title, {
            direction: this.resources.direction,
            duration: this.duration,
            extraClasses: ["mat-toolbar", "mat-primary"]
        });
    }

    public info(message: string, title?: string) {
        this.snackbar.open(message, title, {
            direction: this.resources.direction,
            duration: this.duration,
        });
    }


}