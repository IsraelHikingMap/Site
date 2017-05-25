import { ResourcesService } from "../../../services/ResourcesService";
import { MapService } from "../../../services/MapService";
import { ToastService } from "../../../services/ToastService";
import { LayersService } from "../../../services/layers/LayersService";
import { BaseMapComponent } from "../../BaseMapComponent";
import * as Common from "../../../common/IsraelHiking";

export abstract class LayerBaseDialogComponent extends BaseMapComponent {
    public title: string;
    public key: string;
    public address: string;
    public minZoom: number;
    public maxZoom: number;
    public isNew: boolean;

    constructor(resources: ResourcesService,
        protected mapService: MapService,
        protected layersService: LayersService,
        protected toastService: ToastService
    ) {
        super(resources);
        this.minZoom = LayersService.MIN_ZOOM;
        this.maxZoom = LayersService.MAX_NATIVE_ZOOM;
    }
    public saveLayer = (key: string, address: string, minZoom: number, maxZoom: number, e: Event) => {
        var decodedAddress = decodeURI(address).replace("{zoom}", "{z}");
        var layerData = {
            key: key,
            address: decodedAddress,
            isEditable: true,
            minZoom: minZoom,
            maxZoom: maxZoom,
        } as Common.LayerData;
        var message = this.internalSave(layerData);
        if (message !== "") {
            this.toastService.error(message);
        }
        this.suppressEvents(e);
    }

    protected abstract internalSave(layerData: Common.LayerData): string;

    public removeLayer(e: Event) { } // should be derived if needed.
}