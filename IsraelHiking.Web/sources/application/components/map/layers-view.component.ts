import { Component, OnInit, AfterViewInit, ViewChild, ViewChildren, QueryList, NgZone } from "@angular/core";
import { Router } from "@angular/router";
import { MapComponent, LayerVectorComponent, FeatureComponent, SourceVectorComponent } from "ngx-ol";
import { MapBrowserEvent, Feature } from "ol";
import { Fill, Style, Text, Stroke, Circle } from "ol/style";
import { Point } from "ol/geom";
import { GeoJSON } from "ol/format";
import { Observable } from "rxjs";
import { select } from "@angular-redux/store";

import { PoiService, CategoriesType } from "../../services/poi.service";
import { LayersService } from "../../services/layers/layers.service";
import { CategoriesLayerFactory } from "../../services/layers/categories-layers.factory";
import { SpatialService } from "../../services/spatial.service";
import { RouteStrings } from "../../services/hash.service";
import { BaseMapComponent } from "../base-map.component";
import { ResourcesService } from "../../services/resources.service";
import { LatLngAlt, ApplicationState, Overlay, PointOfInterest, PointOfInterestExtended } from "../../models/models";

@Component({
    selector: "layers-view",
    templateUrl: "layers-view.component.html"
})
export class LayersViewComponent extends BaseMapComponent implements OnInit, AfterViewInit {
    private static readonly MAX_MENU_POINTS_IN_CLUSTER = 7;
    private static readonly SELECTED = "selected_";

    @ViewChildren("cluster")
    public poiLayers: QueryList<LayerVectorComponent>;
    public distance = 100;
    public categoriesTypes: CategoriesType[];

    @ViewChild("selectedPoiFeature")
    public selectedPoiFeature: FeatureComponent;

    @ViewChild("selectedPoiGeoJsonSource")
    public selectedPoiGeoJsonSource: SourceVectorComponent;

    public isClusterOpen: boolean;
    public clusterLatlng: LatLngAlt;
    public clusterPoints: PointOfInterest[];

    public isHoverOpen: boolean;
    public hoverLatlng: LatLngAlt;
    public hoverTitle: string;

    @select((state: ApplicationState) => state.layersState.overlays)
    public overlays: Observable<Overlay[]>;

    @select((state: ApplicationState) => state.poiState.selectedPointOfInterest)
    public selectedPoi$: Observable<PointOfInterestExtended>;

    private whiteFill: Fill;
    private blackFill: Fill;

    constructor(resources: ResourcesService,
        private readonly router: Router,
        private readonly layersService: LayersService,
        private readonly categoriesLayerFactory: CategoriesLayerFactory,
        private readonly poiService: PoiService,
        private readonly ngZone: NgZone,
        private readonly host: MapComponent) {
        super(resources);
        this.categoriesTypes = this.poiService.getCategoriesTypes();
        this.whiteFill = new Fill({
            color: "white"
        });
        this.blackFill = new Fill({
            color: "black"
        });
    }

    public getBaseLayer() {
        return this.layersService.getSelectedBaseLayer();
    }

    public getBaseLayerAddress() {
        return this.layersService.getSelectedBaseLayerAddress();
    }

    public isVisible(categoriesType: CategoriesType) {
        return this.categoriesLayerFactory.get(categoriesType).isVisible();
    }

    ngOnInit() {
        for (let categoriesTypeIndex = 0; categoriesTypeIndex < this.categoriesTypes.length; categoriesTypeIndex++) {
            let categoriesType = this.categoriesTypes[categoriesTypeIndex];
            let index = categoriesTypeIndex; // closure
            this.categoriesLayerFactory.get(categoriesType).markersLoaded.subscribe(() => {
                let features = this.categoriesLayerFactory.get(categoriesType).pointsOfInterest.map(p => {
                    let feature = new Feature(new Point(SpatialService.toViewCoordinate(p.location)));
                    feature.setId(p.source + "__" + p.id);
                    feature.setProperties({ icon: p.icon, iconColor: p.iconColor, title: p.title, hasExtraData: p.hasExtraData });
                    return feature;
                });
                if (index < this.poiLayers.toArray().length) {
                    this.poiLayers.toArray()[index].instance.getSource().getSource().clear();
                    this.poiLayers.toArray()[index].instance.getSource().getSource().addFeatures(features);
                }
            });
        }
    }

    public ngAfterViewInit() {
        this.selectedPoi$.subscribe((poi) => this.onSelectedPoiChanged(poi));

        this.host.instance.on("pointermove", (event: MapBrowserEvent) => this.onPointerMove(event));

        this.host.instance.on("singleclick", (event: MapBrowserEvent) => this.ngZone.run(() => this.onSingleClick(event)));
    }

    public geoJsonLayerStyleFunction = (feature: Feature): (Style | Style[]) => {
        if (feature.getGeometry() instanceof Point &&
            this.selectedPoiGeoJsonSource != null &&
            this.selectedPoiGeoJsonSource.instance.getFeatures().length > 1) {
            let styleArray = this.getPoiIconStyle("icon-star", "blue", false);
            styleArray.push(new Style({
                text: new Text({
                    text: feature.getProperties().name,
                    fill: new Fill({ color: "white" }),
                    stroke: new Stroke({ color: "blue", width: 2 })
                })
            }));
            return styleArray;
        }
        return new Style({
            fill: new Fill({ color: "rgba(19, 106, 224, 0.2)" }),
            stroke: new Stroke({ color: "blue", width: 3 })
        });
    }

    private onSelectedPoiChanged = (poi: PointOfInterestExtended) => {
        if (this.selectedPoiGeoJsonSource == null) {
            return;
        }
        let selectedPoiFeatures = poi != null
            ? new GeoJSON().readFeatures(poi.featureCollection, { dataProjection: "EPSG:4326", featureProjection: "EPSG:3857" })
            : [];
        if (this.selectedPoiFeature != null && poi != null) {
            this.selectedPoiFeature.instance.setStyle(this.getPoiIconStyle(poi.icon, poi.iconColor, poi.hasExtraData));
            this.selectedPoiFeature.instance.setProperties({ title: poi.title });
        }
        this.selectedPoiGeoJsonSource.instance.clear();
        this.selectedPoiGeoJsonSource.instance.addFeatures(selectedPoiFeatures);
    }

    private onPointerMove = (event: MapBrowserEvent) => {
        let featuresAtPixel = (this.host.instance.getFeaturesAtPixel(event.pixel) || []) as Feature[];
        let hit = featuresAtPixel.length !== 0;
        (event.map.getViewport() as HTMLElement).style.cursor = hit ? "pointer" : "";
        if (!hit) {
            this.isHoverOpen = false;
            return;
        }
        let feature = featuresAtPixel[0];
        if (feature.get("features") && feature.get("features").length === 1) {
            feature = feature.get("features")[0] as Feature;
            this.hoverLatlng = SpatialService.fromViewCoordinate((feature.getGeometry() as Point).getCoordinates());
            this.isHoverOpen = true;
            this.hoverTitle = feature.getProperties().title;
            return;
        }

        if (feature.getId() && feature.getId().toString().startsWith(LayersViewComponent.SELECTED)) {
            this.hoverLatlng = SpatialService.fromViewCoordinate((feature.getGeometry() as Point).getCoordinates());
            this.isHoverOpen = true;
            this.hoverTitle = feature.getProperties().title;
            return;
        }
        this.isHoverOpen = false;
    }

    private onSingleClick = (event: MapBrowserEvent) => {
        let featuresAtPixel = event.map.getFeaturesAtPixel(event.pixel) || [];
        if (featuresAtPixel.length === 0) {
            this.isClusterOpen = false;
            return;
        }
        if ((featuresAtPixel[0] as Feature).getId() != null &&
            (featuresAtPixel[0] as Feature).getId().toString().startsWith(LayersViewComponent.SELECTED)) {
            // HM TODO: toggle public poi?
            let sourceAndId = this.getSourceAndId((featuresAtPixel[0] as Feature)
                .getId().toString().replace(LayersViewComponent.SELECTED, ""));
            this.router.navigate([RouteStrings.ROUTE_POI, sourceAndId.source, sourceAndId.id],
                { queryParams: { language: this.resources.getCurrentLanguageCodeSimplified() } });
            return;
        }

        let features = (featuresAtPixel[0].get("features") || []);
        if (features.length === 0) {
            this.isClusterOpen = false;
            return;
        }
        if (features.length === 1) {
            this.isClusterOpen = false;
            let sourceAndId = this.getSourceAndId(features[0].getId().toString());
            this.router.navigate([RouteStrings.ROUTE_POI, sourceAndId.source, sourceAndId.id],
                { queryParams: { language: this.resources.getCurrentLanguageCodeSimplified() } });
            return;
        }
        let coordinates = (featuresAtPixel[0].getGeometry() as Point).getCoordinates();
        let latlng = SpatialService.fromViewCoordinate(coordinates);
        if (this.isClusterOpen &&
            latlng.lat === this.clusterLatlng.lat &&
            this.clusterLatlng.lng === latlng.lng) {
            this.isClusterOpen = false;
            this.clusterLatlng = null;
            this.clusterPoints = [];
            return;
        }
        this.clusterLatlng = latlng;
        this.clusterPoints = features.filter((_, index) => (index < LayersViewComponent.MAX_MENU_POINTS_IN_CLUSTER))
            .map(f => {
                let properties = f.getProperties();
                let sourceAndId = this.getSourceAndId(f.getId().toString());
                return {
                    icon: properties.icon,
                    iconColor: properties.iconColor,
                    title: properties.title,
                    id: sourceAndId.id,
                    source: sourceAndId.source
                };
            });
        this.isClusterOpen = true;
    }

    public getSelectedPoiId(poi: PointOfInterest) {
        if (poi == null) {
            return "invalid";
        }
        return `${LayersViewComponent.SELECTED}${poi.source}__${poi.id}`;
    }

    public getSelectedPoiX(poi: PointOfInterest) {
        if (poi == null) {
            return 0;
        }
        return poi.location.lng;
    }

    public getSelectedPoiY(poi: PointOfInterest) {
        if (poi == null) {
            return 0;
        }
        return poi.location.lat;
    }

    public clusterStyleFunction = (feature: Feature): (Style | Style[]) => {
        let size = feature.get("features").length;
        if (size === 0) {
            return [];
        }
        if (size === 1) {
            let featureProperties = (feature.get("features")[0] as Feature).getProperties();
            return this.getPoiIconStyle(featureProperties.icon, featureProperties.iconColor, featureProperties.hasExtraData);
        }

        let color = {
            outer: "rgba(181, 226, 140, 0.6)",
            inner: "rgba(110, 204, 57, 0.6)"
        };
        if (size > 100) {
            color = {
                outer: "rgba(253,156,115,.6)",
                inner: "rgba(241,128,23,.6)"
            };
        } else if (size > 10) {
            color = {
                outer: "rgba(241,211,87,.6)",
                inner: "rgba(240,194,12,.6)"
            };
        }
        return [
            new Style({
                image: new Circle({
                    radius: 20,
                    fill: new Fill({
                        color: color.outer
                    })
                })
            }),
            new Style({
                image: new Circle({
                    radius: 15,
                    fill: new Fill({
                        color: color.inner
                    })
                }),
                text: new Text({
                    font: "12px \"Helvetica Neue\", Arial, Helvetica, sans-serif",
                    text: `${size}`,
                    fill: this.blackFill
                })
            })
        ];
    }

    private getPoiIconStyle(icon: string, iconColor: string, hasExtraData: boolean) {
        let iconFill = new Fill({
            color: iconColor
        });
        let styleArray = [
            new Style({
                text: new Text({
                    font: "normal 32px IsraelHikingMap",
                    text: this.resources.getCharacterForIcon("icon-map-marker-rect"),
                    fill: new Fill({
                        color: "rgba(0,0,0,0.5)"
                    }),
                    offsetY: -12,
                    offsetX: 2
                }),
            }),
            new Style({
                text: new Text({
                    font: "normal 32px IsraelHikingMap",
                    text: this.resources.getCharacterForIcon("icon-map-marker-rect"),
                    fill: this.whiteFill,
                    offsetY: -14
                }),
            }),
            new Style({
                text: new Text({
                    font: "normal 20px IsraelHikingMap",
                    text: this.resources.getCharacterForIcon(icon),
                    offsetY: -16,
                    fill: iconFill
                }),
            })
        ];
        if (hasExtraData) {
            styleArray.push(
                new Style({
                    text: new Text({
                        font: "normal 6px IsraelHikingMap",
                        text: this.resources.getCharacterForIcon("icon-circle"),
                        offsetY: -24,
                        offsetX: 10,
                        fill: iconFill
                    }),
                })
            );
        }
        return styleArray;
    }

    private getSourceAndId(sourceAndId: string): { source: string, id: string } {
        let poiSource = sourceAndId.split("__")[0];
        let id = sourceAndId.split("__")[1];
        return {
            source: poiSource,
            id: id
        };
    }
}