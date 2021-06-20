export interface LayerData {
    key: string;
    address: string;
    minZoom: number;
    maxZoom: number;
    opacity: number;
}

export interface EditableLayer extends LayerData {
    isEditable: boolean;
    isOfflineAvailable: boolean;
    isOfflineOn: boolean;
    id: string;
}

export interface Overlay extends EditableLayer {
    visible: boolean;
}
