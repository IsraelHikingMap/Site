﻿import type { EditableLayer, Overlay, CategoriesGroup } from "../models";

export type LayersState = {
    baseLayers: EditableLayer[];
    overlays: Overlay[];
    selectedBaseLayerKey: string;
    expanded: string[];
    categoriesGroups: CategoriesGroup[];
}
