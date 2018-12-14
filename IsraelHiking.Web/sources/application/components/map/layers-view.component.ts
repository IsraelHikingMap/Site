import { Component, OnInit, AfterViewInit, ViewChild, ViewChildren, QueryList } from "@angular/core";
import { Router } from "@angular/router";
import { MapComponent, LayerVectorComponent, FeatureComponent } from "ngx-openlayers";
import { style, layer, MapBrowserEvent, Feature, geom, format, source } from "openlayers";
import { Observable } from "rxjs";
import { select } from "@angular-redux/store";

import { PoiService, CategoriesType } from "../../services/poi.service";
import { LayersService } from "../../services/layers/layers.service";
import { CategoriesLayerFactory } from "../../services/layers/categories-layers.factory";
import { SpatialService } from "../../services/spatial.service";
import { RouteStrings } from "../../services/hash.service";
import { BaseMapComponent } from "../base-map.component";
import { ResourcesService } from "../../services/resources.service";
import { Urls } from "../../urls";
import { LatLngAlt, ApplicationState, Overlay, PointOfInterest, PointOfInterestExtended } from "../../models/models";

@Component({
    selector: "layers-view",
    templateUrl: "layers-view.component.html"
})
export class LayersViewComponent extends BaseMapComponent implements OnInit, AfterViewInit {
    private static readonly MAX_MENU_POINTS_IN_CLUSTER = 7;

    @ViewChildren("cluster")
    public poiLayers: QueryList<LayerVectorComponent>;
    public distance = 60;
    public categoriesTypes: CategoriesType[];

    @ViewChild("selectedPoiFeature")
    public selectedPoiFeature: FeatureComponent;

    @ViewChild("selectedPoiGeoJsonLayer")
    public selectedPoiGeoJsonLayer: LayerVectorComponent;

    public isClusterOpen: boolean;
    public clusterLatlng: LatLngAlt;
    public clusterPoints: PointOfInterest[];

    @select((state: ApplicationState) => state.layersState.overlays)
    public overlays: Observable<Overlay[]>;

    @select((state: ApplicationState) => state.poiState.selectedPointOfInterest)
    public selectedPoi$: Observable<PointOfInterestExtended>;

    private whiteFill: style.Fill;
    private blackFill: style.Fill;

    constructor(resources: ResourcesService,
        private readonly router: Router,
        private readonly layersService: LayersService,
        private readonly categoriesLayerFactory: CategoriesLayerFactory,
        private readonly poiService: PoiService,
        private readonly host: MapComponent) {
        super(resources);
        this.categoriesTypes = this.poiService.getCategoriesTypes();
        this.whiteFill = new style.Fill({
            color: "white"
        });
        this.blackFill = new style.Fill({
            color: "black"
        });
    }

    public getBaseLayerUrl() {
        let selectedBaseLayer = this.layersService.getSelectedBaseLayer();
        let address = this.getFullAddress(selectedBaseLayer.address);
        if (selectedBaseLayer.key === LayersService.ISRAEL_HIKING_MAP || selectedBaseLayer.key === LayersService.ISRAEL_MTB_MAP) {
            address = this.getTileAddressForCurrentLanguage(address);
        }
        return address;
    }

    public getFullAddress(address: string) {
        return address.toLowerCase().endsWith("/mapserver") ? `${address}/tile/{z}/{y}/{x}` : address;
    }

    public getBaseLayerMinZoom() {
        return this.layersService.getSelectedBaseLayer().minZoom;
    }

    public getBaseLayerMaxZoom() {
        return this.layersService.getSelectedBaseLayer().maxZoom;
    }

    private getTileAddressForCurrentLanguage(addressPostfix: string): string {
        return Urls.baseTilesAddress + this.resources.currentLanguage.tilesFolder + addressPostfix;
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
                    let feature = new Feature(new geom.Point(SpatialService.toViewCoordinate(p.location)));
                    feature.setId(p.source + "__" + p.id);
                    feature.setProperties({ icon: p.icon, iconColor: p.iconColor, name: p.title, hasExtraData: p.hasExtraData });
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
        this.poiLayers.forEach(l => (l.instance as layer.Vector).setStyle((feature) => this.createClusterIcon(feature)));
        this.selectedPoi$.subscribe((poi) => {
            if (this.selectedPoiGeoJsonLayer == null) {
                return;
            }
            let vectorSource = new source.Vector({
                features: []
            });
            if (poi == null) {
                this.selectedPoiGeoJsonLayer.instance.setSource(vectorSource);
                return;
            }
            if (this.selectedPoiFeature != null) {
                this.selectedPoiFeature.instance.setStyle(this.getPoiIconStyle(poi.icon, poi.iconColor, poi.hasExtraData));
            }
            vectorSource = new source.Vector({
                features: new format.GeoJSON().readFeatures(poi.featureCollection,
                    { dataProjection: "EPSG:4326", featureProjection: "EPSG:3857" })
            });
            this.selectedPoiGeoJsonLayer.instance.setSource(vectorSource);
        });
        this.host.instance.on("pointermove",
            (event: MapBrowserEvent) => {
                let featuresAtPixel = (this.host.instance.getFeaturesAtPixel(event.pixel) || []) as Feature[];
                let hit = featuresAtPixel.length !== 0;
                (event.map.getViewport() as HTMLElement).style.cursor = hit ? "pointer" : "";
                if (!hit) {
                    return;
                }
                if (featuresAtPixel[0].get("features") && featuresAtPixel[0].get("features").length === 1) {
                    // HM TODO: hover on single feature - show title
                }
            });
        this.host.instance.on("singleclick",
            (event: MapBrowserEvent) => {
                let featuresAtPixel = event.map.getFeaturesAtPixel(event.pixel) || [];
                if (featuresAtPixel.length === 0) {
                    this.isClusterOpen = false;
                    return;
                }
                if ((featuresAtPixel[0] as Feature).getId() != null &&
                    (featuresAtPixel[0] as Feature).getId().toString().startsWith("selected_")) {
                    // HM TODO: toggle public poi?
                    let sourceAndId = this.getSourceAndId((featuresAtPixel[0] as Feature).getId().toString().replace("selected_", ""));
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
                let coordinates = (featuresAtPixel[0].getGeometry() as geom.Point).getCoordinates();
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
                            title: properties.name,
                            id: sourceAndId.id,
                            source: sourceAndId.source
                        };
                    });
                this.isClusterOpen = true;
            });
    }

    public getSelectedPoiId(poi: PointOfInterest) {
        if (poi == null) {
            return "invalid";
        }
        return `selected_${poi.source}__${poi.id}`;
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

    private createClusterIcon(feature): (style.Style | style.Style[]) {
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
            new style.Style({
                image: new style.Circle({
                    radius: 20,
                    fill: new style.Fill({
                        color: color.outer
                    })
                })
            }),
            new style.Style({
                image: new style.Circle({
                    radius: 15,
                    fill: new style.Fill({
                        color: color.inner
                    })
                }),
                text: new style.Text({
                    font: "12px \"Helvetica Neue\", Arial, Helvetica, sans-serif",
                    text: `${size}`,
                    fill: this.blackFill
                })
            })
        ];
    }

    private getPoiIconStyle(icon: string, iconColor: string, hasExtraData: boolean) {
        let iconFill = new style.Fill({
            color: iconColor
        });
        let styleArray = [
            new style.Style({
                text: new style.Text({
                    font: "normal 32px IsraelHikingMap",
                    text: this.resources.getCharacterForIcon("icon-map-marker-rect"),
                    fill: new style.Fill({
                        color: "rgba(0,0,0,0.5)"
                    }),
                    offsetY: -12,
                    offsetX: 2
                }),
            }),
            new style.Style({
                text: new style.Text({
                    font: "normal 32px IsraelHikingMap",
                    text: this.resources.getCharacterForIcon("icon-map-marker-rect"),
                    fill: this.whiteFill,
                    offsetY: -14
                }),
            }),
            new style.Style({
                text: new style.Text({
                    font: "normal 20px IsraelHikingMap",
                    text: this.resources.getCharacterForIcon(icon),
                    offsetY: -16,
                    fill: iconFill
                }),
            })
        ];
        if (hasExtraData) {
            styleArray.push(
                new style.Style({
                    text: new style.Text({
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