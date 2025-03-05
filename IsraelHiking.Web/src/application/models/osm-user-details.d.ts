export type OsmUserDetails = {
    user: {
        id: number;
        display_name: string;
        img?: {
            href: string;
        };
        changesets: {
            count: number;
        };
    };
};
