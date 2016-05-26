module IsraelHiking.Services.Drawing {
    export interface IMarkerWithTitle extends L.Marker {
        title: string;
    }

    export class DrawingMarker extends BaseDrawing<Common.MarkerData[]> {
        private $compile: angular.ICompileService;
        private $rootScope: angular.IRootScopeService;
        private markers: IMarkerWithTitle[];
        private icon: L.Icon;
        private hoverMarker: L.Marker;

        constructor($compile: angular.ICompileService,
            $rootScope: angular.IRootScopeService,
            mapService: MapService,
            hashService: HashService) {
            super(mapService, hashService);
            this.name = Common.Constants.MARKERS;
            this.$compile = $compile;
            this.$rootScope = $rootScope;
            this.enabled = false;
            this.markers = [];
            this.icon = IconsService.createMarkerIconWithColor(this.getColor());
            this.hoverMarker = L.marker(this.map.getCenter(), { clickable: false, icon: this.icon } as L.MarkerOptions);
            this.addDataToStack(this.getData());
            this.state = DrawingState.inactive;
            this.createInactiveMarkers();

            this.map.on("mousemove", this.onMouseMove, this);

            this.map.on("click", (e: L.LeafletMouseEvent) => {
                if (this.isEnabled()) {
                    this.addMarker(e.latlng);
                }
            });
        }

        private addMarker = (latlng: L.LatLng) => {
            this.markers.push(this.createMarker(latlng));
            this.updateDataLayer();
        }

        private removeMarker = (marker: IMarkerWithTitle) => {
            var markerIndex = this.markers.indexOf(marker);
            if (markerIndex !== -1) {
                this.removeMarkerFromMap(markerIndex);
            }
        }

        public getData = (): Common.MarkerData[] => {
            var data = [];
            for (let markerIndex = 0; markerIndex < this.markers.length; markerIndex++) {
                data.push({
                    latlng: this.markers[markerIndex].getLatLng(),
                    title: this.markers[markerIndex].title || ""
                } as Common.MarkerData);
            }
            return data;
        }

        public setData = (data: Common.MarkerData[]) => {
            this.internalClear();
            this.addMarkersInternal(data);
        }

        private addMarkersInternal = (data: Common.MarkerData[]) => {
            for (let markerData of data) {
                var marker = this.createMarker(markerData.latlng, markerData.title);
                this.markers.push(marker);
            }
        }

        public addMarkers = (data: Common.MarkerData[]) => {
            this.addMarkersInternal(data);
            this.updateDataLayer();
        }

        private createMarker(latlng: L.LatLng, title = ""): IMarkerWithTitle {
            var marker = L.marker(latlng, { draggable: true, clickable: true, riseOnHover: true } as L.MarkerOptions) as IMarkerWithTitle;
            marker.bindLabel(title, this.getBindLableOptions());
            marker.title = title;
            var newScope = this.$rootScope.$new() as Controllers.IMarkerPopupScope;
            newScope.title = title;
            newScope.marker = marker;
            newScope.setTitle = (newTitle: string) => {
                marker.title = newTitle;
                marker.updateLabelContent(newTitle);
                if (!newTitle) {
                    marker.hideLabel();    
                } else {
                    marker.showLabel();
                }
                this.updateDataLayer();
                marker.closePopup();
            }
            var popupHtml = this.$compile("<marker-popup ng-title='title'></marker-popup>")(newScope)[0];
            marker.bindPopup(popupHtml);

            marker.on("dblclick", () => {
                this.removeMarker(marker);
                this.updateDataLayer();
            });
            marker.on("dragend", () => {
                this.updateDataLayer();
            });
            marker.on("dragStart", () => {
                marker.closePopup();
            });
            marker.on("click", () => {
                marker.openPopup();
            });
            marker.setIcon(this.icon);
            marker.addTo(this.map);
            if (!title) { // must be after adding to map...
                marker.hideLabel();
            }
            return marker;
        }

        private createInactiveMarker = (latlng: L.LatLng, title: string): IMarkerWithTitle => {
            var marker = L.marker(latlng, { draggable: false, clickable: true, riseOnHover: true } as L.MarkerOptions) as IMarkerWithTitle;
            marker.bindLabel(title, this.getBindLableOptions());
            marker.title = title;
            marker.bindPopup(marker.title);
            marker.on("click", () => {
                marker.openPopup();
            });
            marker.setIcon(this.icon);
            marker.addTo(this.map);
            if (!title) { // must be after adding to map
                marker.hideLabel();
            }
            return marker;
        }

        private internalClear = () => {
            for (let markerIndex = this.markers.length - 1; markerIndex >= 0; markerIndex--) {
                this.removeMarkerFromMap(markerIndex);
            }
        }

        private removeMarkerFromMap = (markerIndex: number) => {
            var marker = this.markers[markerIndex];
            marker.off("click");
            marker.off("dragstart");
            marker.off("dragend");
            marker.off("mouseover");
            marker.off("dblclick");
            marker.off("popupopen");
            marker.unbindLabel();
            this.map.removeLayer(marker);
            this.markers.splice(markerIndex, 1);
        }

        public clear = () => {
            this.internalClear();
            this.updateDataLayer();
        }

        public changeStateTo = (targetState: string) => {
            if (targetState === this.state) {
                return;
            }
            switch (this.state) {
                case DrawingState.hidden:
                    if (targetState === DrawingState.active) {
                        this.createActiveMarkers();
                    } else {
                        this.createInactiveMarkers();
                    }
                    break;
                case DrawingState.inactive:
                    if (targetState === DrawingState.active) {
                        this.createActiveMarkers();
                    }
                    if (targetState === DrawingState.hidden) {
                        this.hideMarkers();
                    }
                    break;
                case DrawingState.active:
                    if (targetState === DrawingState.hidden) {
                        this.hideMarkers();
                    } else {
                        this.createInactiveMarkers();
                    }
                    break;
            }

            this.state = targetState;
            this.updateHoverMarker();
        }

        private createInactiveMarkers = () => {
            var data = this.getData();
            this.internalClear();
            for (let markerData of data) {
                var marker = this.createInactiveMarker(markerData.latlng, markerData.title);
                this.markers.push(marker);
            }
        }

        private createActiveMarkers = () => {
            var data = this.getData();
            this.internalClear();
            for (let markerData of data) {
                var marker = this.createMarker(markerData.latlng, markerData.title);
                this.markers.push(marker);
            }
        }

        private hideMarkers = () => {
            for (let markerIndex = 0; markerIndex < this.markers.length; markerIndex++) {
                var marker = this.markers[markerIndex];
                this.map.removeLayer(marker);
            }
        }

        private updateDataLayer = () => {
            var data = this.getData();
            this.addDataToStack(data);
        }

        public getColor = () => {
            return "green";
        }

        public getColorKeyValue = () => {
            return { key: "marker", value: this.getColor() };
        }

        public enable = (enable: boolean): void => {
            this.enabled = enable;
            this.updateHoverMarker();
        }

        private updateHoverMarker = () => {
            if (this.isEnabled()) {
                this.map.addLayer(this.hoverMarker);
            } else {
                this.map.removeLayer(this.hoverMarker);
            }
        }

        private onMouseMove = (e: L.LeafletMouseEvent) => {
            if (this.isEnabled() === false) {
                return;
            }
            this.hoverMarker.setLatLng(e.latlng);
        }

        private getBindLableOptions = (): L.LabelOptions => {
            return { noHide: true, className: "marker-label" } as L.LabelOptions;
        }
    }
}