import { components } from "./user-data.g.js";

export type EditableLayer = components["schemas"]["LayerData"] & {
    isEditable: boolean;
    id: string;
};