export type CategoriesGroupType = "Points of Interest" | "Routes";

export type IconColorLabel = {
    icon: string;
    color: string;
    label: string;
};

export type Category = {
    name: string;
    icon: string;
    color: string;
    visible: boolean;
    items: { iconColorCategory: IconColorLabel; tags: any[] }[];
};

export type CategoriesGroup = {
    type: CategoriesGroupType;
    visible: boolean;
    categories: Category[];
};
