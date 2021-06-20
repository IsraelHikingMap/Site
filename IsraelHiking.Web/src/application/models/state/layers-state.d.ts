import { EditableLayer, Overlay, CategoriesGroup } from "../models";

export interface LayersState {
    baseLayers: EditableLayer[];
    overlays: Overlay[];
    selectedBaseLayerKey: string;
    expanded: string[];
    categoriesGroups: CategoriesGroup[];
}
