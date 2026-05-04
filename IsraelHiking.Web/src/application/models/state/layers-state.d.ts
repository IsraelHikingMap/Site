import type { EditableLayer } from "..";

export type LayersState = {
    baseLayers: EditableLayer[];
    overlays: EditableLayer[];
    selectedBaseLayerKey: string;
    expanded: string[];
    visiblePoisCategories: string[];
    visibleOverlays: string[];
};
