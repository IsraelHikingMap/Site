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
    selectableItems: IconColorLabel[];
};

export type CategoriesGroup = {
    type: CategoriesGroupType;
    categories: Category[];
};
