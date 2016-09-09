namespace IsraelHiking.Controllers.LayerProperties {
    export interface ILayerBaseScope extends IRootScope {
        title: string;
        key: string;
        address: string;
        minZoom: number;
        maxZoom: number;
        isNew: boolean;
        toggleVisibility(e: Event);
        saveLayer(key: string, address: string, minZoom: number, maxZoom: number, e: Event): void;
    }

    export interface ILayerBaseEditScope<TLayer> extends ILayerBaseScope {
        layer: TLayer;
        removeLayer(e: Event): void;
    }

    export abstract class LayerBaseController extends BaseMapController {
        protected layersService: Services.Layers.LayersService;

        constructor($scope: ILayerBaseScope,
            mapService: Services.MapService,
            layersService: Services.Layers.LayersService,
            toastr: Toastr) {
            super(mapService);
            this.layersService = layersService;
            $scope.minZoom = Services.Layers.LayersService.MIN_ZOOM;
            $scope.maxZoom = Services.Layers.LayersService.MAX_NATIVE_ZOOM;

            $scope.saveLayer = (key: string, address: string, minZoom: number, maxZoom: number, e: Event) => {
                var decodedAddress = decodeURI(address).replace("{zoom}", "{z}");
                var layerData = {
                    key: key,
                    address: decodedAddress,
                    isEditable: true,
                    minZoom: minZoom,
                    maxZoom: maxZoom,
                } as Common.LayerData;
                var message = this.internalSave($scope, layerData);
                if (message !== "") {
                    toastr.error(message);
                }
                this.suppressEvents(e);
            }
        }
        // should be implemented in derrived classes
        protected internalSave = ($scope: ILayerBaseScope, layerData: Common.LayerData): string => { throw Error("Implementation Error.") }

    }
}