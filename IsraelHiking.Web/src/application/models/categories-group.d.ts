export type IconColorLabel = {
    icon: string;
    color: string;
    label: string;
};

export type Category = {
    name: string;
    icon: string;
    color: string;
    selectableItems: IconColorLabel[];
};
