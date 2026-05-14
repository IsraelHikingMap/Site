import { components } from "./user-data.g";

export type EditableLayer = components["schemas"]["LayerData"] & {
    isEditable: boolean;
    id: string;
};