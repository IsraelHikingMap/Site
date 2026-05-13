import { Difficulty } from "./";

export type CategoryType = "Hiking" | "Bicycle" | "4x4";

export type PublicRoutesFilter = {
    categories: CategoryType[];
    difficulty: Difficulty[];
    lengthRange: [number, number];
    userId: string;
}