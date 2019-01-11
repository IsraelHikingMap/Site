import { EditableLayer, Overlay } from "../models";

export interface LayersState {
    baseLayers: EditableLayer[];
    overlays: Overlay[];
    selectedBaseLayerKey: string;
    expanded: string[];
    visible: {name: string, visible: boolean}[];
}