﻿export type LayerData = {
    key: string;
    address: string;
    minZoom: number;
    maxZoom: number;
    opacity: number;
}

export type EditableLayer = LayerData & {
    isEditable: boolean;
    isOfflineAvailable: boolean;
    isOfflineOn: boolean;
    id: string;
}

export type Overlay = EditableLayer & {
    visible: boolean;
}
