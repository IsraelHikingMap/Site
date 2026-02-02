import { Component, inject } from "@angular/core";
import { AsyncPipe, DatePipe } from "@angular/common";
import { MatButton } from "@angular/material/button";
import { MatFormField, MatLabel, MatOption, MatSelect } from "@angular/material/select";
import { Dir } from "@angular/cdk/bidi";
import { MatTooltip } from "@angular/material/tooltip";
import { Store } from "@ngxs/store";
import { Observable } from "rxjs";
import { Immutable } from "immer";
import { MapComponent } from "@maplibre/ngx-maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";

import { AutomaticLayerPresentationComponent } from "../map/automatic-layer-presentation.component";
import { DistancePipe } from "../../pipes/distance.pipe";
import { ResourcesService } from "../../services/resources.service";
import { ShareUrlsService } from "../../services/share-urls.service";
import { DefaultStyleService } from "../../services/default-style.service";
import { LayersService } from "../../services/layers.service";
import type { ApplicationState, EditableLayer, ShareUrl } from "../../models";

@Component({
    selector: 'shares',
    templateUrl: './shares.component.html',
    styleUrls: ['./shares.component.scss'],
    imports: [AsyncPipe, MapComponent, AutomaticLayerPresentationComponent, MatButton, MatSelect, MatOption, MatLabel, MatFormField, Dir, DatePipe, DistancePipe, MatTooltip]
})
export class SharesComponent {
    public mapStyle: StyleSpecification;
    public baseLayerData: EditableLayer;
    public selectedShareUrlId: string = null;


    public readonly resources = inject(ResourcesService);

    private readonly shareUrlsService = inject(ShareUrlsService);
    private readonly defaultStyleService = inject(DefaultStyleService);
    private readonly layersService = inject(LayersService);

    private readonly store = inject(Store);
    public shareUrls$: Observable<Immutable<ShareUrl[]>>;

    constructor() {
        this.shareUrls$ = this.store.select((s: ApplicationState) => s.shareUrlsState.shareUrls);
        this.mapStyle = this.defaultStyleService.getStyleWithPlaceholders();
        this.baseLayerData = this.layersService.getSelectedBaseLayer();
    }

    public getImageFromShareId(shareUrl: Immutable<ShareUrl>, width: number, height: number) {
        return this.shareUrlsService.getImageUrlFromShareId(shareUrl.id, width, height);
    }

    public toggleSelectedShareUrl(event: Event, shareUrl: Immutable<ShareUrl>) {
        if (event.target !== event.currentTarget) {
            return;
        }
        if (this.selectedShareUrlId == null || this.selectedShareUrlId !== shareUrl.id) {
            this.selectedShareUrlId = shareUrl.id;
        } else {
            this.selectedShareUrlId = null;
        }
    }
}