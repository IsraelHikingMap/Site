import type { EditableLayer } from "..";

export type LayersState = {
    baseLayers: EditableLayer[];
    overlays: EditableLayer[];
    selectedBaseLayerKey: string;
    expanded: string[];
    visiblePoisCategories: string[];
    visibleOverlays: string[];
    /**
     * Keys of the layers the user chose not to list in the layers panel, kept so they can be listed again. Base
     * layers and overlays are kept apart since an overlay may share its key with a base layer.
     */
    hiddenBaseLayers: string[];
    hiddenOverlays: string[];
};
