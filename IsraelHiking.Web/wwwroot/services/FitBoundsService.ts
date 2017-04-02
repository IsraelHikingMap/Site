namespace IsraelHiking.Services {
    export class FitBoundService extends ObjectWithMap {
        private sideBarService: SidebarService;

        constructor(mapService: MapService, sidebarService: SidebarService) {
            super(mapService);

            this.sideBarService = sidebarService;
        }

        public fitBounds(bounds: L.LatLngBounds, options: L.Map.FitBoundsOptions = {}) {
            options.paddingTopLeft = this.sideBarService.isVisible && this.map.getContainer().clientWidth >= 768
                ? L.point(400, 50)
                : L.point(50, 50);

            options.paddingBottomRight = L.point(50, 50);
            this.map.fitBounds(bounds, options);
        }
    }
}