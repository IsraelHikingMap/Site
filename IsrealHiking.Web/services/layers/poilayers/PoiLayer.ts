namespace IsraelHiking.Services.Layers.PoiLayers {

    export interface IMarkerWithTitle extends L.Marker {
        title: string;
    }

    export interface IMarkerWithData extends Common.MarkerData {
        marker: IMarkerWithTitle;
    }

    export class PoiLayer extends ObjectWithMap implements IDrawingLayer {
        private currentState: PoiStateBase;
        private undoHandler: RouteLayers.UndoHandler<Common.MarkerData[]>;

        public $rootScope: angular.IRootScopeService;
        public $compile: angular.ICompileService;
        public $timeout: angular.ITimeoutService;
        public pathOptions: L.PathOptions;
        public markers: IMarkerWithData[];
        public eventHelper: Common.EventHelper<{}>;

        constructor($rootScope: angular.IRootScopeService,
            $compile: angular.ICompileService,
            $timeout: angular.ITimeoutService,
            masService: MapService) {
            super(masService);

            this.$rootScope = $rootScope;
            this.$compile = $compile;
            this.$timeout = $timeout;
            this.undoHandler = new RouteLayers.UndoHandler<Common.MarkerData[]>();
            this.markers = [];
            this.pathOptions = { color: "green", opacity: 0.7 } as L.PathOptions;
            this.undoHandler.addDataToUndoStack(this.getData());
            this.currentState = new PoiStateReadOnly(this);
        }

        onAdd(map: Map<Object, Object>): void {
            this.readOnly();
        }

        onRemove(map: Map<Object, Object>): void {

        }

        public setState = (state: PoiStateBase) => {
            this.currentState = state;
            this.eventHelper = new Common.EventHelper<{}>();
        }

        public getEditMode(): EditMode {
            return this.currentState.getEditMode();
        }

        public edit() {
            this.currentState.setEditState();
        }

        public readOnly() {
            this.currentState.setReadOnlyState();
        }

        public clearCurrentState() {
            this.currentState.clear();
        }

        public getBindLabelOptions = (): L.LabelOptions => {
            return { noHide: true, className: "marker-label" } as L.LabelOptions;
        }

        public getData = (): Common.MarkerData[] => {
            let markersData = [] as Common.MarkerData[];
            for (let marker of this.markers) {
                markersData.push({
                    latlng: marker.latlng,
                    title: marker.title
                } as Common.MarkerData);
            }
            return markersData;
        }

        public setData = (data: Common.MarkerData[]) => {
            this.setDataInternal(data);
            this.currentState.initialize();
        }

        public updateDataFromState = () => {
            let data = this.getData();
            this.setDataInternal(data);
        }

        private setDataInternal = (data: Common.MarkerData[]) => {
            this.currentState.clear();
            this.markers = [];

            for (let markerData of data) {
                let marker = angular.copy(markerData) as IMarkerWithData;
                marker.marker = null;
                this.markers.push(marker);
            }
        }

        public clear = () => {
            this.currentState.clear();
            this.markers = [];
            this.dataChanged();
            this.currentState.initialize();
        }

        public undo = () => {
            this.undoHandler.pop();
            this.setData(this.undoHandler.top());
        }

        public isUndoDisbaled = (): boolean => {
            return this.undoHandler.isUndoDisbaled() || this.currentState.getEditMode() === EditModeString.none;
        }

        public dataChanged = () => {
            var data = this.getData();
            this.undoHandler.addDataToUndoStack(data);
            this.eventHelper.raiseEvent({});
        }
    }
}