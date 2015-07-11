module IsraelHiking.Services {
    export interface MarkerWithTitle extends L.Marker {
        title: string;
    }

    export interface IDataChangedEventArgs {
        applyToScope: boolean;
    }

    export class DrawingMarkerService extends ObjectWithMap {
        private $compile: angular.ICompileService;
        private $rootScope: angular.IRootScopeService;
        private markers: MarkerWithTitle[];
        private icon: L.Icon;
        private enabled: boolean;
        public eventHelper: Common.EventHelper<IDataChangedEventArgs>;

        constructor($compile: angular.ICompileService,
            $rootScope: angular.IRootScopeService,
            mapService: MapService) {
            super(mapService);
            this.$compile = $compile;
            this.$rootScope = $rootScope;
            this.enabled = false;
            this.markers = [];
            this.eventHelper = new Common.EventHelper<IDataChangedEventArgs>();
            this.icon = new L.Icon.Default(<L.IconOptions> { iconUrl: L.Icon.Default.imagePath + "/marker-icon-green.png" });
            this.map.on("click",(e: L.LeafletMouseEvent) => {
                if (this.isEnabled()) {
                    this.addMarker(e.latlng);
                    this.eventHelper.raiseEvent({ applyToScope: true });
                }
            });
        }

        public enable = (enable: boolean) => {
            this.enabled = enable;
        }

        public isEnabled = (): boolean => {
            return this.enabled;
        }

        private addMarker = (latlng: L.LatLng) => {
            this.markers.push(this.createMarker(latlng));
        }

        private removeMarker = (marker: MarkerWithTitle) => {
            var markerIndex = this.markers.indexOf(marker);
            if (markerIndex != -1) {
                this.removeMarkerFromMap(markerIndex);
            }
        }

        public getData = (): Common.MarkerData[] => {
            var data = [];
            for (var markerIndex = 0; markerIndex < this.markers.length; markerIndex++) {
                data.push(<Common.MarkerData>{
                    latlng: this.markers[markerIndex].getLatLng(),
                    title: this.markers[markerIndex].title,
                });
            }
            return data;
        }

        public setData = (data: Common.MarkerData[]) => {
            this.internalClear();
            for (var markerIndex = 0; markerIndex < data.length; markerIndex++) {
                var markerData = data[markerIndex];
                var marker = this.createMarker(markerData.latlng, markerData.title);
                this.markers.push(marker);
            }
        }

        private createMarker(latlng: L.LatLng, title = ""): MarkerWithTitle {
            var marker = <MarkerWithTitle>L.marker(latlng, <L.MarkerOptions> { draggable: true, clickable: true, riseOnHover: true });
            marker.on("click",(e: L.LeafletMouseEvent) => {
                this.removeMarker(marker);
                this.eventHelper.raiseEvent({ applyToScope: true });
            });
            marker.on("dragend",(e: L.LeafletMouseEvent) => {
                this.eventHelper.raiseEvent({ applyToScope: true });
            });
            marker.on("dragStart",(e: L.LeafletMouseEvent) => {
                marker.closePopup();
            });
            marker.on("mouseover",(e: L.LeafletMouseEvent) => {
                marker.openPopup();
            });
            marker.title = title;
            var newScope = <Controllers.IMarkerPopupScope>this.$rootScope.$new();
            newScope.title = title;
            newScope.setTitle = (title: string) => {
                marker.title = title;
                this.eventHelper.raiseEvent({ applyToScope: false });
            }
            marker.bindPopup(this.$compile("<marker-popup ng-title='title'></marker-popup>")(newScope)[0]);
            
            marker.setIcon(this.icon);
            marker.addTo(this.map);
            return marker;
        }

        public clear = () => {
            this.internalClear();
            this.eventHelper.raiseEvent({ applyToScope: false });
        }

        private internalClear = () => {
            for (var markerIndex = this.markers.length -1; markerIndex >= 0; markerIndex--) {
                this.removeMarkerFromMap(markerIndex);
            }
        }

        private removeMarkerFromMap = (markerIndex: number) => {
            var marker = this.markers[markerIndex];
            marker.off("click");
            marker.off("dragstart");
            marker.off("dragend");
            marker.off("mouseover");
            this.map.removeLayer(marker);
            this.markers.splice(markerIndex, 1);
        }
    }
}