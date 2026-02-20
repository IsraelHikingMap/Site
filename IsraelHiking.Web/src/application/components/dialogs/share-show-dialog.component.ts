import { Component, inject } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogClose, MatDialogContent } from "@angular/material/dialog";
import { MatButton } from "@angular/material/button";
import { Dir } from "@angular/cdk/bidi";
import type { Immutable } from "immer";

import { ShareItemComponent } from "../share-item.component";
import { ResourcesService } from "../../services/resources.service";
import type { ShareUrl } from "../../models";

@Component({
    selector: "app-share-show-dialog",
    templateUrl: "./share-show-dialog.component.html",
    imports: [MatDialogContent, MatButton, Dir, MatDialogClose, ShareItemComponent]
})
export class ShareShowDialogComponent {
    public resources = inject(ResourcesService);

    public shareUrl = inject<Immutable<ShareUrl>>(MAT_DIALOG_DATA);

    constructor() { }
}