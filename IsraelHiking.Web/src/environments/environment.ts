// The file contents for the current environment will overwrite these during build.
// The build system defaults to the dev environment which uses `environment.ts`, but if you do
// `ng build:prod` then `environment.prod.ts` will be used instead.
// The list of which env maps to which file can be found in `angular.json`.

export const environment = {
    production: false,
    baseAddress: typeof window !== 'undefined' ? window.location.origin : "https://israelhiking.osm.org.il",
    baseApiAddress: typeof window !== 'undefined' ? window.location.origin + "/api/" : "https://israelhiking.osm.org.il/api/",
    baseTilesAddress: "https://israelhiking.osm.org.il",
    isCapacitor: false
};
