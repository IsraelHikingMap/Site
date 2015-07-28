module IsraelHiking.Services.Drawing {
    export interface MarkerWithTitle extends L.Marker {
        title: string;
    }

    export class DrawingMarker extends BaseDrawing<Common.MarkerData[]> {
        private $compile: angular.ICompileService;
        private $rootScope: angular.IRootScopeService;
        private markers: MarkerWithTitle[];
        private icon: L.Icon;
        private enabled: boolean;

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
            this.icon = new L.Icon.Default(<L.IconOptions> { iconUrl: L.Icon.Default.imagePath + "/marker-icon-green.png" });
            this.addDataToStack(this.getData());

            this.map.on("click",(e: L.LeafletMouseEvent) => {
                if (this.active) {
                    this.addMarker(e.latlng);
                }
            });
        }

        private addMarker = (latlng: L.LatLng) => {
            this.markers.push(this.createMarker(latlng));
            this.updateDataLayer();
        }

        private removeMarker = (marker: MarkerWithTitle) => {
            var markerIndex = this.markers.indexOf(marker);
            if (markerIndex != -1) {
                this.removeMarkerFromMap(markerIndex);
            }
        }

        public getData = (): Common.MarkerData[]=> {
            var data = [];
            for (var markerIndex = 0; markerIndex < this.markers.length; markerIndex++) {
                data.push(<Common.MarkerData>{
                    latlng: this.markers[markerIndex].getLatLng(),
                    title: this.markers[markerIndex].title || "",
                });
            }
            return data;
        }

        public setData = (data: Common.MarkerData[]) => {
            this.internalClear();
            this.addMarkers(data);
        }

        public addMarkers = (data: Common.MarkerData[]) => {
            for (var markerIndex = 0; markerIndex < data.length; markerIndex++) {
                var markerData = data[markerIndex];
                var marker = this.createMarker(markerData.latlng, markerData.title);
                this.markers.push(marker);
            }
        }

        private createMarker(latlng: L.LatLng, title = ""): MarkerWithTitle {
            var marker = <MarkerWithTitle>L.marker(latlng, <L.MarkerOptions> { draggable: true, clickable: true, riseOnHover: true });
            marker.title = title;
            var newScope = <Controllers.IMarkerPopupScope>this.$rootScope.$new();
            newScope.title = title;
            newScope.setTitle = (title: string) => {
                marker.title = title;
                this.updateDataLayer();
            }
            var popupHtml = this.$compile("<marker-popup ng-title='title'></marker-popup>")(newScope)[0];
            marker.bindPopup(popupHtml);

            marker.on("dblclick",(e: L.LeafletMouseEvent) => {
                this.removeMarker(marker);
                this.updateDataLayer();
            });
            marker.on("dragend",(e: L.LeafletMouseEvent) => {
                this.updateDataLayer();
            });
            marker.on("dragStart",(e: L.LeafletMouseEvent) => {
                marker.closePopup();
            });
            marker.on("click",(e: L.LeafletMouseEvent) => {
                marker.openPopup();
            });
            marker.setIcon(this.icon);
            marker.addTo(this.map);
            return marker;
        }

        private internalClear = () => {
            for (var markerIndex = this.markers.length - 1; markerIndex >= 0; markerIndex--) {
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
            this.map.removeLayer(marker);
            this.markers.splice(markerIndex, 1);
        }

        public activate = () => {
            this.active = true;
			this.enabled = true;
            var data = this.getData();
            this.internalClear();
            this.setData(data);
        }

        public clear = () => {
            this.internalClear();
            this.updateDataLayer();
        }

        public deactivate = () => {
            this.active = false;
			this.enabled = false;
            var data = this.getData();
            this.internalClear();
            for (var markerIndex = 0; markerIndex < data.length; markerIndex++) {
                var markerData = data[markerIndex];
                var marker = <MarkerWithTitle>L.marker(markerData.latlng, <L.MarkerOptions> { draggable: false, clickable: true, riseOnHover: true });
                marker.title = markerData.title;
                marker.bindPopup(marker.title);
                marker.on("click",(e: L.LeafletMouseEvent) => {
                    marker.openPopup();
                });
                marker.setIcon(this.icon);
                marker.addTo(this.map);
                this.markers.push(marker);
            }
        }

        private updateDataLayer = () => {
            var data = this.getData();
            this.hashService.updateMarkers(data);
            this.addDataToStack(data);
        }

        protected postUndoHook = () => {
            var data = this.getData();
            this.hashService.updateMarkers(data);
        }
    }
}