import { Component, OnInit, AfterViewInit, ViewChildren, QueryList } from "@angular/core";
import { Router } from "@angular/router";
import { MapComponent, LayerVectorComponent } from "ngx-openlayers";
import { style, layer, MapBrowserEvent, Feature, geom } from "openlayers";

import { PoiService, CategoriesType } from "../services/poi.service";
import { LayersService } from "../services/layers/layers.service";
import { CategoriesLayerFactory } from "../services/layers/categories-layers.factory";
import { SpatialService } from "../services/spatial.service";
import { RouteStrings } from "../services/hash.service";
import { BaseMapComponent } from "./base-map.component";
import { ResourcesService } from "../services/resources.service";

@Component({
    selector: "layers-view",
    templateUrl: "layers-view.component.html"
})
export class LayersViewComponent extends BaseMapComponent implements OnInit, AfterViewInit {

    public distance = 60;

    @ViewChildren(LayerVectorComponent)
    public poiLayers: QueryList<LayerVectorComponent>;

    private whiteFill: style.Fill;
    public categoriesTypes: CategoriesType[];

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
    }

    public getBaseLayer() {
        return this.layersService.selectedBaseLayer.address;
    }

    public getOverlays() {
        return this.layersService.overlays;
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
                    feature.setProperties({ icon: p.icon, iconColor: p.iconColor, name: p.title });
                    return feature;
                });
                this.poiLayers.toArray()[index].instance.getSource().getSource().clear();
                this.poiLayers.toArray()[index].instance.getSource().getSource().addFeatures(features);
            });
        }
    }

    public ngAfterViewInit() {
        // HM TODO: hover and cluster click.
        this.poiLayers.forEach(l => (l.instance as layer.Vector).setStyle((feature) => this.createClusterIcon(feature)));
        this.host.instance.on("singleclick", (event: MapBrowserEvent) => {
            let features = event.map.getFeaturesAtPixel(event.pixel) || [];
            if (features.length === 0) {
                return;
            }
            let size = (features[0].get("features") || []).length;
            if (size !== 1) {
                return;
            }
            let sourceAndId = features[0].get("features")[0].getId() as string;
            let source = sourceAndId.split("__")[0];
            let id = sourceAndId.split("__")[1];
            this.router.navigate([RouteStrings.ROUTE_POI, source, id]);
        });
    }

    private createClusterIcon(feature): (style.Style | style.Style[]) {
        let size = feature.get("features").length;
        if (size === 0) {
            return [];
        }
        if (size === 1) {
            let featureProperties = (feature.get("features")[0] as Feature).getProperties();
            return [
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
                        text: this.resources.getCharacterForIcon(featureProperties.icon),
                        offsetY: -16,
                        fill: new style.Fill({
                            color: featureProperties.iconColor
                        })
                    }),
                })
            ];
        }

        let color = {
            outer: "rgba(181, 226, 140, 0.6)",
            inner: "rgba(110, 204, 57, 0.6)"
        }
        if (size > 100) {
            color = {
                outer: "rgba(253,156,115,.6)",
                inner: "rgba(241,128,23,.6)"
            }
        } else if (size > 10) {
            color = {
                outer: "rgba(241,211,87,.6)",
                inner: "rgba(240,194,12,.6)"
            }
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
                    fill: new ol.style.Fill({
                        color: color.inner
                    })
                }),
                text: new style.Text({
                    font: '12px "Helvetica Neue", Arial, Helvetica, sans-serif',
                    text: `${size}`,
                    fill: this.whiteFill
                })
            })
        ];
    }
}