import { Component, inject } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle } from "@angular/material/dialog";
import { FormsModule } from "@angular/forms";
import { MatFormField } from "@angular/material/form-field";
import { MatInput, MatLabel } from "@angular/material/input";
import { MatOption, MatSelect } from "@angular/material/select";
import { MatButton } from "@angular/material/button";
import { Dir } from "@angular/cdk/bidi";

import { ResourcesService } from "../../services/resources.service";
import { TracesService } from "../../services/traces.service";
import { ToastService } from "../../services/toast.service";
import type { Trace, TraceVisibility } from "../../models";


@Component({
    selector: "edit-trace-dialog",
    templateUrl: "./edit-trace-dialog.component.html",
    imports: [FormsModule, MatFormField, MatLabel, MatInput, MatOption, MatSelect, MatButton, MatDialogActions, MatDialogTitle, MatDialogContent, MatDialogClose, Dir]
})
export class EditTraceDialogComponent {
    public description: string = "";
    public tagsString: string = "";
    public visibility: TraceVisibility = "trackable";
    public title: string = "";

    public resources = inject(ResourcesService);
    private readonly tracesService = inject(TracesService);
    private readonly toastService = inject(ToastService);
    private readonly data = inject<Trace>(MAT_DIALOG_DATA);

    constructor() {
        this.title = this.data.visibility === "local" ? this.data.name : this.data.description;
        this.description = this.data.description;
        this.tagsString = this.data.tagsString;
        this.visibility = this.data.visibility;
    }

    public async update() {
        const updatedTrace = {
            ...structuredClone(this.data),
            tagsString: this.tagsString,
            description: this.description,
            visibility: this.visibility,
        }
        await this.tracesService.updateTrace(updatedTrace);
        this.toastService.success(this.resources.dataUpdatedSuccessfully);
    }
}