/** An option of a list's sort menu: what the list is sorted by, the resource its label is read from and its analytics label. */
export type SortOption<T> = {
    value: T;
    label: "date" | "name" | "difficulty" | "routeType" | "length";
    analyticsLabel: string;
};
