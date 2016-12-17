namespace IsraelHiking.Services.Layers.RouteLayers {

    export class RouteStateEditRoute extends RouteStateEdit {
        constructor(context: RouteLayers.RouteLayer) {
            super(context);
            this.hoverHandler.setHoverPolylineState(true);
        }

        protected addPoint(e: L.LeafletMouseEvent): void {
            let snappingResponse = this.context.snappingService.snapTo(e.latlng);
            this.addPointToRoute(snappingResponse.latlng, this.context.route.properties.currentRoutingType).then(() => {
                this.context.dataChanged();
            });
            this.hoverHandler.setState(HoverHandler.NONE);
        }

        private addPointToRoute = (latlng: L.LatLng, routingType: string): angular.IPromise<{}> => {
            this.context.route.segments.push(this.createRouteSegment(latlng, [this.context.getLatLngZFromLatLng(latlng), this.context.getLatLngZFromLatLng(latlng)], routingType));
            this.updateStartAndEndMarkersIcons();
            if (this.context.route.segments.length > 1) {
                let endPointSegmentIndex = this.context.route.segments.length - 1;
                return this.runRouting(endPointSegmentIndex - 1, endPointSegmentIndex);
            } else if (this.context.route.segments.length === 1) {
                return this.context.elevationProvider.updateHeights(this.context.route.segments[0].latlngzs);
            }
            var deferred = this.context.$q.defer<{}>();
            deferred.resolve();

            return deferred.promise;
        }

        public getEditMode(): EditMode {
            return EditModeString.route;
        }
    }
}