import type { EditableLayer, CategoriesGroupType } from "..";

export type LayersState = {
    baseLayers: EditableLayer[];
    overlays: EditableLayer[];
    selectedBaseLayerKey: string;
    expanded: string[];
    visibleCategories: { name: string; groupType: CategoriesGroupType; }[];
    visibleOverlays: string[];
};
