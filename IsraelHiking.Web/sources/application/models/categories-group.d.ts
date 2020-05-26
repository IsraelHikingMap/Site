export type CategoriesGroupType = "Points of Interest" | "Routes";

export interface IconColorLabel {
    icon: string;
    color: string;
    label: string;
}

export interface Category {
    name: string;
    icon: string;
    color: string;
    visible: boolean;
    items: { iconColorCategory: IIconColorLabel; tags: any[] }[];
}

export interface CategoriesGroup {
    type: CategoriesGroupType;
    visible: boolean;
    categories: Category[];
}