import type { EditableLayer, Overlay, CategoriesGroupType } from "..";

export type LayersState = {
    baseLayers: EditableLayer[];
    overlays: Overlay[];
    selectedBaseLayerKey: string;
    expanded: string[];
    visibleCategories: { name: string; groupType: CategoriesGroupType; }[];
};
